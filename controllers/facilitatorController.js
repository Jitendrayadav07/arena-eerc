const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
const { ethers } = require("ethers");
const { decryptPrivateKey } = require("../utils/cryptoUtils");

const THIRDWEB_BASE_URL = "https://api.thirdweb.com/v1";

/**
 * R1 & R2: Single endpoint for distribution
 * - Without X-PAYMENT: Returns 402 Payment Required
 * - With X-PAYMENT: Executes payment and processes distribution
 */
const runDistribution = async (req, res) => {
    try {
        const { entity_id, recipients, network } = req.body;
        const paymentAuth = req.headers['x-payment'] || req.headers['X-PAYMENT'];
        const api_key = req.headers["x-secret-key"];

        // Validation
        if (!entity_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).send(
                Response.sendResponse(false, null, "entity_id and recipients array are required", 400)
            );
        }

        if (!network) {
            return res.status(400).send(
                Response.sendResponse(false, null, "network is required", 400)
            );
        }

        // Verify entity exists and validate API key
        const entity = await db.tbl_entities.findOne({ where: { entity_id, api_key } });
        if (!entity) {
            return res.status(401).send(
                Response.sendResponse(false, null, "Invalid Api Key", 401)
            );
        }

        // Get token contract address from environment variable
        const tokenContractAddress = process.env.TOKEN_CONTRACT_ADDRESS;
        if (!tokenContractAddress) {
            return res.status(500).send(
                Response.sendResponse(false, null, "Token contract address not configured. Please set TOKEN_CONTRACT_ADDRESS environment variable.", 500)
            );
        }

        // Get entity wallet
        const entityWallet = await db.tbl_wallets.findOne({
            where: { entity_id, network }
        });

        if (!entityWallet) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Entity wallet not found for this network", 404)
            );
        }

        // Calculate totals
        const totalAmount = recipients.reduce((sum, recipient) => {
            return sum + parseFloat(recipient.amount || 0);
        }, 0);

        // Service fee: 1 eUSDC (0.1% as per flowchart)
        const serviceFee = 0.01; // Fixed 1 eUSDC
        const paymentAmount = totalAmount + serviceFee;

        // Get service address from environment
        const serviceAddress = process.env.SERVICE_WALLET_ADDRESS;
        if (!serviceAddress) {
            return res.status(500).send(
                Response.sendResponse(false, null, "Service wallet address not configured", 500)
            );
        }

        // R1: No X-PAYMENT header - Return 402 Payment Required
        if (!paymentAuth) {
            // Check if distribution already exists for this request
            let distribution = await db.tbl_distributions.findOne({
                where: {
                    entity_id,
                    status: 'PENDING_PAYMENT',
                    total_amount: totalAmount,
                    payment_amount: paymentAmount
                },
                order: [['createdAt', 'DESC']]
            });

            // Create new distribution record if doesn't exist
            if (!distribution) {
                const batchId = `batch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
                distribution = await db.tbl_distributions.create({
                    batch_id: batchId,
                    entity_id,
                    total_amount: totalAmount,
                    service_fee: serviceFee,
                    payment_amount: paymentAmount,
                    service_address: serviceAddress,
                    recipients: recipients,
                    status: 'PENDING_PAYMENT',
                    network
                });
            }

            // Return 402 Payment Required with payment instructions
            return res.status(402).send(
                Response.sendResponse(
                    false,
                    {
                        batch_id: distribution.batch_id,
                        payment_required: true,
                        payment_amount: paymentAmount,
                        service_fee: serviceFee,
                        total_distribution: totalAmount,
                        payTo: serviceAddress,
                        network: network,
                        token_contract: tokenContractAddress,
                        instructions: `Resend this request with X-PAYMENT header to authorize payment of ${paymentAmount} eUSDC to ${serviceAddress}`
                    },
                    "Payment Required",
                    402
                )
            );
        }

        // R2: X-PAYMENT header present - Process payment and distribution
        // Find or create distribution record
        let distribution = await db.tbl_distributions.findOne({
            where: {
                entity_id,
                status: 'PENDING_PAYMENT',
                total_amount: totalAmount,
                payment_amount: paymentAmount
            },
            order: [['createdAt', 'DESC']]
        });

        if (!distribution) {
            // Create new distribution if not found
            const batchId = `batch_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
            distribution = await db.tbl_distributions.create({
                batch_id: batchId,
                entity_id,
                total_amount: totalAmount,
                service_fee: serviceFee,
                payment_amount: paymentAmount,
                service_address: serviceAddress,
                recipients: recipients,
                status: 'PENDING_PAYMENT',
                network
            });
        }

        if (distribution.status !== 'PENDING_PAYMENT') {
            return res.status(400).send(
                Response.sendResponse(false, null, `Distribution already processed. Current status: ${distribution.status}`, 400)
            );
        }

        // R3: Facilitator validates & settles payment
        // Execute payment from org wallet to service address
        const chainId = network === "avalanche-fuji" ? 43113 : 43114;
        
        // Execute ERC20 token transfer (eUSDC) from org wallet to service address
        const serviceTxHash = await executeERC20Transfer(
            entityWallet,
            serviceAddress,
            paymentAmount,
            tokenContractAddress,
            chainId
        );

        if (!serviceTxHash) {
            distribution.status = 'FAILED';
            await distribution.save();
            return res.status(500).send(
                Response.sendResponse(false, null, "Failed to execute payment to service address", 500)
            );
        }

        // Wait for transaction confirmation
        console.log("Waiting for transaction confirmation:", serviceTxHash);
        try {
            const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
            
            // Wait for transaction to be confirmed (default is 1 confirmation)
            const receipt = await provider.waitForTransaction(serviceTxHash, 1, 60000); // 60 second timeout
            
            if (!receipt || receipt.status !== 1) {
                distribution.status = 'FAILED';
                await distribution.save();
                return res.status(500).send(
                    Response.sendResponse(false, null, "Transaction failed or was reverted", 500)
                );
            }
            
            console.log("Transaction confirmed:", serviceTxHash);
            
            // Wait for 2 seconds after confirmation
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log("2 second delay completed, proceeding with payouts");
        } catch (error) {
            console.error("Error waiting for transaction confirmation:", error);
            distribution.status = 'FAILED';
            await distribution.save();
            return res.status(500).send(
                Response.sendResponse(false, null, `Failed to confirm transaction: ${error.message}`, 500)
            );
        }

        // Update distribution with payment info
        distribution.service_tx_hash = serviceTxHash;
        distribution.payment_authorization = paymentAuth;
        distribution.status = 'SETTLEMENT_CONFIRMED';
        await distribution.save();

        // R4 & R5: Process encrypted payouts
        // Service keeps 1 eUSDC, distribute remaining to employees
        const payoutResults = await processEncryptedPayouts(
            distribution,
            tokenContractAddress,
            serviceAddress
        );

        if (!payoutResults.success) {
            distribution.status = 'FAILED';
            await distribution.save();
            return res.status(500).send(
                Response.sendResponse(false, null, payoutResults.error, 500)
            );
        }

        // R6: Update final status and return response
        distribution.distribution_tx_hash = payoutResults.distributionTxHash;
        distribution.status = 'COMPLETED';
        await distribution.save();

        return res.status(200).send(
            Response.sendResponse(
                true,
                {
                    batch_id: distribution.batch_id,
                    service_tx_hash: distribution.service_tx_hash,
                    distribution_tx_hash: distribution.distribution_tx_hash,
                    status: 'COMPLETED',
                    total_distributed: distribution.total_amount,
                    service_fee: distribution.service_fee,
                    recipients_count: distribution.recipients.length
                },
                "Distribution completed successfully",
                200
            )
        );
    } catch (error) {
        console.error("Run distribution error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

/**
 * Execute ERC20 token transfer from org wallet to service address
 * Uses external transfer API endpoint
 */
const executeERC20Transfer = async (fromWallet, toAddress, amount, tokenContract, chainId) => {
    try {
        // Decrypt private key from wallet
        let privateKey;
        try {
            privateKey = decryptPrivateKey(fromWallet.encrypted_private_key);
        } catch (error) {
            console.error("Failed to decrypt private key:", error.message);
            return null;
        }

        // Map chainId to chain format for transfer API
        // 43113 (Avalanche Fuji) -> "testnet", 43114 (Avalanche Mainnet) -> "mainnet"
        const chain = "mainnet";

        // Get EERC contract addresses from environment
        const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS;
        const registrarAddress = process.env.REGISTRAR_ADDRESS;

        if (!eercContractAddress || !registrarAddress) {
            console.error("EERC contract address or registrar address not configured");
            return null;
        }

        // Prepare transfer API request body
        const transferRequestBody = {
            recipient: toAddress,
            amount: amount.toString(),
            tokenAddress: tokenContract,
            chain: chain,
            eercContractAddress: eercContractAddress,
            registrarAddress: registrarAddress,
            privateKey: privateKey
        };

        // Call external transfer API
        const transferApiUrl = process.env.TRANSFER_API_URL;
        
        console.log("Calling transfer API:", transferApiUrl);
        console.log("Transfer request body (privateKey hidden):", {
            ...transferRequestBody,
            privateKey: "***HIDDEN***"
        });

        const transferResponse = await axios.post(transferApiUrl, transferRequestBody, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 300000 // 5 minutes timeout for transfer operations
        });

        // Extract transaction hash from response
        if (transferResponse.status === 200 || transferResponse.status === 201) {
            const txHash = transferResponse.data?.txHash || 
                transferResponse.data?.transactionHash ||
                transferResponse.data?.hash;
            
            if (txHash) {
                return txHash;
            } else {
                console.error("Transfer API response missing transaction hash:", transferResponse.data);
                return null;
            }
        } else {
            console.error(`Transfer API returned status ${transferResponse.status}:`, transferResponse.data);
            return null;
        }
    } catch (error) {
        console.error("ERC20 transfer error:", error.response?.data || error.message);
        return null;
    }
};

/**
 * R5: Process encrypted payouts to sub-entity users (employees)
 * Calls external airdrop API to distribute tokens to sub-entity users
 * Uses service wallet to send payments to recipients
 */
const processEncryptedPayouts = async (distribution, tokenContract, serviceAddress) => {
    try {
        // Get service wallet private key from environment variable
        const privateKey = process.env.SERVICE_WALLET_PRIVATE_KEY;

        if (!privateKey) {
            return {
                success: false,
                error: "Service wallet private key not configured. Please set SERVICE_WALLET_PRIVATE_KEY environment variable."
            };
        }

        // Map network to chain format for airdrop API
        // "avalanche-fuji" -> "testnet", "avalanche-mainnet" or "mainnet" -> "mainnet"
        const chain = "mainnet";

        // Get EERC contract addresses from environment or entity config
        const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS;
        const registrarAddress = process.env.REGISTRAR_ADDRESS;

        if (!eercContractAddress || !registrarAddress) {
            return {
                success: false,
                error: "EERC contract address or registrar address not configured. Please set EERC_CONTRACT_ADDRESS and REGISTRAR_ADDRESS environment variables."
            };
        }

        // Transform recipients from {address, amount} or {employee_address, amount} to {address, amount}
        const recipients = distribution.recipients.map(recipient => ({
            address: recipient.address || recipient.employee_address,
            amount: recipient.amount.toString()
        }));

        // Prepare airdrop API request body
        const airdropRequestBody = {
            recipients: recipients,
            tokenAddress: tokenContract,
            chain: chain,
            eercContractAddress: eercContractAddress,
            registrarAddress: registrarAddress,
            privateKey: privateKey
        };

        // Call external airdrop API
        const airdropApiUrl = process.env.AIRDROP_API_URL;
        
        console.log("Calling airdrop API:", airdropApiUrl);
        console.log("Airdrop request body (privateKey hidden):", {
            ...airdropRequestBody,
            privateKey: "***HIDDEN***"
        });

        const airdropResponse = await axios.post(airdropApiUrl, airdropRequestBody, {
            headers: {
                "Content-Type": "application/json"
            },
            timeout: 300000 // 5 minutes timeout for airdrop operations
        });

        // Check if airdrop was successful
        if (airdropResponse.status === 200 || airdropResponse.status === 201) {
            // Extract transaction hash from response if available
            const distributionTxHash = airdropResponse.data?.txHash || 
                airdropResponse.data?.transactionHash ||
                airdropResponse.data?.batchId ||
                `airdrop_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

            return {
                success: true,
                distributionTxHash,
                airdropResponse: airdropResponse.data
            };
        } else {
            return {
                success: false,
                error: `Airdrop API returned status ${airdropResponse.status}`,
                airdropResponse: airdropResponse.data
            };
        }
    } catch (error) {
        console.error("Process encrypted payouts error:", error);
        return {
            success: false,
            error: error.response?.data?.message || error.message || "Failed to process airdrop",
            airdropError: error.response?.data
        };
    }
};

/**
 * Get distribution status
 */
const getDistributionStatus = async (req, res) => {
    try {
        const { batch_id } = req.params;

        if (!batch_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "batch_id is required", 400)
            );
        }

        const distribution = await db.tbl_distributions.findOne({
            where: { batch_id }
        });

        if (!distribution) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Distribution batch not found", 404)
            );
        }

        return res.status(200).send(
            Response.sendResponse(
                true,
                {
                    batch_id: distribution.batch_id,
                    status: distribution.status,
                    total_amount: distribution.total_amount,
                    service_fee: distribution.service_fee,
                    payment_amount: distribution.payment_amount,
                    service_tx_hash: distribution.service_tx_hash,
                    distribution_tx_hash: distribution.distribution_tx_hash,
                    recipients_count: distribution.recipients.length,
                    created_at: distribution.createdAt,
                    updated_at: distribution.updatedAt
                },
                "Distribution status retrieved",
                200
            )
        );
    } catch (error) {
        console.error("Get distribution status error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

/**
 * Get decrypted private key for entity or sub-entity
 * Requires x-secret-key header for authentication
 */
const getDecryptedPrivateKey = async (req, res) => {
    try {
        const { entity_id, sub_entity_id, network } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        // Validate x-secret-key header
        if (!secretKey) {
            return res.status(400).send(
                Response.sendResponse(false, null, "x-secret-key header is required", 400)
            );
        }

        // Validate that either entity_id or sub_entity_id is provided
        if (!entity_id && !sub_entity_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "Either entity_id or sub_entity_id is required", 400)
            );
        }

        // Validate that both are not provided
        if (entity_id && sub_entity_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "Please provide either entity_id or sub_entity_id, not both", 400)
            );
        }

        // Default network if not provided
        const walletNetwork = network || "avalanche-fuji";

        let wallet = null;
        let entity = null;
        let finalEntityId = null;

        if (entity_id) {
            // Get entity and validate API key
            entity = await db.tbl_entities.findOne({ where: { entity_id, api_key: secretKey } });
            if (!entity) {
                return res.status(401).send(
                    Response.sendResponse(false, null, "Invalid Api Key or Entity not found", 401)
                );
            }

            finalEntityId = entity_id;

            // Get entity wallet
            wallet = await db.tbl_wallets.findOne({
                where: { entity_id, network: walletNetwork }
            });

            if (!wallet) {
                return res.status(404).send(
                    Response.sendResponse(false, null, `Entity wallet not found for network: ${walletNetwork}`, 404)
                );
            }
        } else if (sub_entity_id) {
            // Get sub-entity
            const subEntity = await db.tbl_sub_entity.findOne({ where: { sub_entity_id } });
            if (!subEntity) {
                return res.status(404).send(
                    Response.sendResponse(false, null, "Sub-entity not found", 404)
                );
            }

            finalEntityId = subEntity.entity_id;

            // Get parent entity to validate API key
            entity = await db.tbl_entities.findOne({ where: { entity_id: subEntity.entity_id, api_key: secretKey } });
            if (!entity) {
                return res.status(401).send(
                    Response.sendResponse(false, null, "Invalid Api Key", 401)
                );
            }

            // Get sub-entity wallet
            wallet = await db.tbl_sub_entities_wallets.findOne({
                where: { sub_entity_id, network: walletNetwork }
            });

            if (!wallet) {
                return res.status(404).send(
                    Response.sendResponse(false, null, `Sub-entity wallet not found for network: ${walletNetwork}`, 404)
                );
            }
        }

        // Decrypt private key
        let privateKey;
        try {
            privateKey = decryptPrivateKey(wallet.encrypted_private_key);
        } catch (error) {
            return res.status(500).send(
                Response.sendResponse(false, null, `Failed to decrypt private key: ${error.message}`, 500)
            );
        }

        return res.status(200).send(
            Response.sendResponse(
                true,
                {
                    entity_id: finalEntityId,
                    sub_entity_id: sub_entity_id || null,
                    address: wallet.address,
                    private_key: privateKey,
                    network: walletNetwork
                },
                "Private key retrieved successfully",
                200
            )
        );
    } catch (error) {
        console.error("Get decrypted private key error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

module.exports = {
    runDistribution,
    getDistributionStatus,
    getDecryptedPrivateKey,
    executeERC20Transfer
};
