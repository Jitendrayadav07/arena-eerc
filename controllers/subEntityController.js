const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
const { ethers } = require("ethers");
require("dotenv").config();
const ENTITY_CONSTANTS = require("../constants/entityConstants");
const sendEmail = require("../utils/sendEmail");
const { generateSubEntityToken } = require("../utils/jwtSubEntity");
const { createSubEntityEmailData } = require("../utils/createSubEntityEmailData");
const { JWT_EERCx402_SECRET } = require("../config/jwtTokenKey");
const jwt = require("jsonwebtoken");
const { getAvaxBalance, getEusdcBalance } = require("./entityController");
const { decryptPrivateKey, encryptPrivateKey } = require("../utils/cryptoUtils");
const { executeERC20Transfer } = require("./facilitatorController");

const registerSubEntity = async (req, res) => {
    try {
        const { email_id, name, role } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        if (!email_id || !name || !role) {
            return res.status(400).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.INVALID_PAYLOAD, 400));
        }

        if (!secretKey) {
            return res.status(400).send(Response.sendResponse(false, null, "x-secret-key header is required", 400));
        }

        // Get entity by api_key (x-secret-key)
        const entity = await db.tbl_entities.findOne({ where: { api_key: secretKey } });
        if (!entity) {
            return res.status(401).send(Response.sendResponse(false, null, "Invalid Api Key", 401));
        }

        const entity_id = entity.entity_id;
        const existing = await db.tbl_sub_entity.findOne({ where: { email_id } });
        if (existing) {
            return res.status(409).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS, 409));
        }

        const existingEntity = await db.tbl_entities.findOne({ where: { email_id } });
        if (existingEntity) {
            return res.status(409).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS, 409));
        }

        // Generate a new EVM wallet
        const wallet = ethers.Wallet.createRandom();
        const walletAddress = wallet.address;
        const privateKey = wallet.privateKey;

        // Encrypt the private key
        const encryptedPrivateKey = encryptPrivateKey(privateKey);

        // Create entity
        const sub_entity = await db.tbl_sub_entity.create({
            name,
            role,
            email_id,
            entity_id
        });

        // Create wallet for the entity
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.create({
            sub_entity_id: sub_entity.sub_entity_id,
            address: walletAddress,
            encrypted_private_key: encryptedPrivateKey,
            network: process.env.CHAIN_NAME || "avalanche-fuji",
            chain_id: process.env.CHAIN_ID?.toString() || "eip155:43113",
        });

        let token = generateSubEntityToken(sub_entity, sub_entity_wallet);

        const emailData = createSubEntityEmailData(sub_entity, token, sub_entity_wallet.address);

        await sendEmail(sub_entity.email_id, emailData.subject, emailData.templateName, emailData);
        return res.status(200).send(Response.sendResponse(true, sub_entity, ENTITY_CONSTANTS.ENTITY_CREATED, 200));
    } catch (error) {
        return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
    }
};

const verifySubEntity = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return res.status(400).send("Invalid verification link");
        }

        // Decode token
        const decoded = jwt.verify(token, JWT_EERCx402_SECRET);

        // Fetch sub-entity
        const sub_entity = await db.tbl_sub_entity.findOne({
            where: { email_id: decoded.email_id, sub_entity_id: decoded.sub_entity_id }
        });
        if (!sub_entity) return res.status(404).send("Sub-entity not found");

        // validate private key decryption
        let decryptedPrivateKey;
        try {
            decryptedPrivateKey = decryptPrivateKey(decoded.encrypted_private_key);
        } catch (err) {
            console.log("Private key decryption failed:", err.message);
            return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=invalid_wallet");
        }

        // Get parameters from environment
        const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS;
        const chain = process.env.CHAIN || "mainnet";
        const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS;
        const registrarAddress = process.env.REGISTRAR_ADDRESS;
        const registerApiUrl = process.env.REGISTER_API_URL;

        // Validate required environment variables
        if (!tokenAddress || !eercContractAddress || !registrarAddress) {
            console.error("Missing required environment variables for register API");
            return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=config_error");
        }

        // Call register API
        try {
            const registerRequestBody = {
                tokenAddress: tokenAddress,
                chain: chain,
                eercContractAddress: eercContractAddress,
                registrarAddress: registrarAddress,
                privateKey: decryptedPrivateKey
            };

            console.log("Calling register API:", registerApiUrl);
            console.log("Register request body (privateKey hidden):", {
                ...registerRequestBody,
                privateKey: "***HIDDEN***"
            });

            const registerResponse = await axios.post(registerApiUrl, registerRequestBody, {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 300000 // 5 minutes timeout
            });

            if (registerResponse.status === 200 || registerResponse.status === 201) {
                console.log("Register API call successful:", registerResponse.data);
                return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=success");
            } else {
                console.error("Register API returned unexpected status:", registerResponse.status);
                return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=register_failed");
            }
        } catch (registerError) {
            console.error("Register API call failed:", registerError.response?.data || registerError.message);
            return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=register_failed");
        }

    } catch (error) {
        console.error("Verify sub-entity error:", error);
        return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=failed");
    }
};

const resendVerificationToken = async (req, res) => {
    try {
        const { sub_entity_id } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        // Validate x-secret-key header
        if (!secretKey) {
            return res.status(400).send(
                Response.sendResponse(false, null, "x-secret-key header is required", 400)
            );
        }

        // Validate sub_entity_id
        if (!sub_entity_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "sub_entity_id is required", 400)
            );
        }

        // Get sub-entity
        const sub_entity = await db.tbl_sub_entity.findOne({ where: { sub_entity_id } });
        if (!sub_entity) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity not found", 404)
            );
        }

        // Get parent entity and validate API key
        const entity = await db.tbl_entities.findOne({
            where: { entity_id: sub_entity.entity_id, api_key: secretKey }
        });
        if (!entity) {
            return res.status(401).send(
                Response.sendResponse(false, null, "Invalid Api Key", 401)
            );
        }

        // Get sub-entity wallet
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.findOne({
            where: { sub_entity_id }
        });

        if (!sub_entity_wallet) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity wallet not found", 404)
            );
        }

        // Generate new verification token
        const token = generateSubEntityToken(sub_entity, sub_entity_wallet);

        // Create email data
        const emailData = createSubEntityEmailData(sub_entity, token, sub_entity_wallet.address);

        // Send verification email
        await sendEmail(sub_entity.email_id, emailData.subject, emailData.templateName, emailData);

        return res.status(200).send(
            Response.sendResponse(
                true,
                {
                    sub_entity_id: sub_entity.sub_entity_id,
                    entity_id: sub_entity.entity_id,
                    email_id: sub_entity.email_id,
                    message: "Verification token has been resent to your email"
                },
                "Verification token resent successfully",
                200
            )
        );
    } catch (error) {
        console.error("Resend verification token error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

const depositToken = async (req, res) => {
    try {
        const { sub_entity_id, amount } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        // Validate x-secret-key header
        if (!secretKey) {
            return res.status(400).send(
                Response.sendResponse(false, null, "x-secret-key header is required", 400)
            );
        }

        // Validate sub_entity_id
        if (!sub_entity_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "sub_entity_id is required", 400)
            );
        }

        // Validate amount
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).send(
                Response.sendResponse(false, null, "Valid amount is required", 400)
            );
        }

        // Get sub-entity
        const sub_entity = await db.tbl_sub_entity.findOne({ where: { sub_entity_id } });
        if (!sub_entity) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity not found", 404)
            );
        }

        // Get parent entity and validate API key
        const entity = await db.tbl_entities.findOne({
            where: { entity_id: sub_entity.entity_id, api_key: secretKey }
        });
        if (!entity) {
            return res.status(401).send(
                Response.sendResponse(false, null, "Invalid Api Key or Sub-entity not found", 401)
            );
        }

        // Get sub-entity wallet
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.findOne({
            where: { sub_entity_id }
        });

        if (!sub_entity_wallet) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity wallet not found", 404)
            );
        }

        // Decrypt private key
        let decryptedPrivateKey;
        try {
            decryptedPrivateKey = decryptPrivateKey(sub_entity_wallet.encrypted_private_key);
        } catch (err) {
            console.log("Private key decryption failed:", err.message);
            return res.status(500).send(
                Response.sendResponse(false, null, "Failed to decrypt private key", 500)
            );
        }

        // Convert amount: client sends 0.6, we need 0.0000000000006000 (multiply by 10^-12)
        const convertedAmount = (parseFloat(amount) * Math.pow(10, -12)).toFixed(16);

        // Get parameters from environment
        const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS || "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";
        const chain = process.env.CHAIN || "mainnet";
        const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS || "0x15bA3e8D6cf0aFe0Fa48a5F81D1Fb0b9Fe77F613";
        const registrarAddress = process.env.REGISTRAR_ADDRESS || "0xCA36B4E3078980f6d8A49De844b6a7349B330d13";
        const depositApiUrl = process.env.DEPOSIT_API_URL;

        // Call deposit API
        try {
            const depositRequestBody = {
                amount: convertedAmount,
                tokenAddress: tokenAddress,
                chain: chain,
                eercContractAddress: eercContractAddress,
                registrarAddress: registrarAddress,
                privateKey: decryptedPrivateKey
            };

            console.log("Calling deposit API:", depositApiUrl);
            console.log("Deposit request body (privateKey hidden):", {
                ...depositRequestBody,
                privateKey: "***HIDDEN***"
            });

            const depositResponse = await axios.post(depositApiUrl, depositRequestBody, {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 300000 // 5 minutes timeout
            });

            if (depositResponse.status === 200 || depositResponse.status === 201) {
                console.log("Deposit API call successful:", depositResponse.data);
                return res.status(200).send(
                    Response.sendResponse(
                        true,
                        {
                            sub_entity_id: sub_entity.sub_entity_id,
                            entity_id: sub_entity.entity_id,
                            originalAmount: amount,
                            convertedAmount: convertedAmount,
                            depositResponse: depositResponse.data
                        },
                        "Token deposit successful",
                        200
                    )
                );
            } else {
                console.error("Deposit API returned unexpected status:", depositResponse.status);
                return res.status(depositResponse.status || 500).send(
                    Response.sendResponse(
                        false,
                        null,
                        depositResponse.data?.message || "Deposit failed",
                        depositResponse.status || 500
                    )
                );
            }
        } catch (depositError) {
            console.error("Deposit API call failed:", depositError.response?.data || depositError.message);
            return res.status(depositError.response?.status || 500).send(
                Response.sendResponse(
                    false,
                    null,
                    depositError.response?.data?.message || depositError.message || "Deposit failed",
                    depositError.response?.status || 500
                )
            );
        }

    } catch (error) {
        console.error("Deposit token error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

const withdrawToken = async (req, res) => {
    try {
        const { sub_entity_id, amount } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        // Validate x-secret-key header
        if (!secretKey) {
            return res.status(400).send(
                Response.sendResponse(false, null, "x-secret-key header is required", 400)
            );
        }

        // Validate sub_entity_id
        if (!sub_entity_id) {
            return res.status(400).send(
                Response.sendResponse(false, null, "sub_entity_id is required", 400)
            );
        }

        // Validate amount
        if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).send(
                Response.sendResponse(false, null, "Valid amount is required", 400)
            );
        }

        // Get sub-entity
        const sub_entity = await db.tbl_sub_entity.findOne({ where: { sub_entity_id } });
        if (!sub_entity) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity not found", 404)
            );
        }

        // Get parent entity and validate API key
        const entity = await db.tbl_entities.findOne({
            where: { entity_id: sub_entity.entity_id, api_key: secretKey }
        });
        if (!entity) {
            return res.status(401).send(
                Response.sendResponse(false, null, "Invalid Api Key or Sub-entity not found", 401)
            );
        }

        // Get sub-entity wallet
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.findOne({
            where: { sub_entity_id }
        });

        if (!sub_entity_wallet) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity wallet not found", 404)
            );
        }

        // Decrypt private key
        let decryptedPrivateKey;
        try {
            decryptedPrivateKey = decryptPrivateKey(sub_entity_wallet.encrypted_private_key);
        } catch (err) {
            console.log("Private key decryption failed:", err.message);
            return res.status(500).send(
                Response.sendResponse(false, null, "Failed to decrypt private key", 500)
            );
        }

        // Amount is passed as-is (no conversion needed)
        const withdrawAmount = amount.toString();

        // Get parameters from environment
        const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS || "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";
        const chain = process.env.CHAIN || "mainnet";
        const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS || "0x15bA3e8D6cf0aFe0Fa48a5F81D1Fb0b9Fe77F613";
        const registrarAddress = process.env.REGISTRAR_ADDRESS || "0xCA36B4E3078980f6d8A49De844b6a7349B330d13";
        const withdrawApiUrl = process.env.WITHDRAW_API_URL;

        // Call withdraw API
        try {
            const withdrawRequestBody = {
                amount: withdrawAmount,
                tokenAddress: tokenAddress,
                chain: chain,
                eercContractAddress: eercContractAddress,
                registrarAddress: registrarAddress,
                privateKey: decryptedPrivateKey
            };

            console.log("Calling withdraw API:", withdrawApiUrl);
            console.log("Withdraw request body (privateKey hidden):", {
                ...withdrawRequestBody,
                privateKey: "***HIDDEN***"
            });

            const withdrawResponse = await axios.post(withdrawApiUrl, withdrawRequestBody, {
                headers: {
                    "Content-Type": "application/json"
                },
                timeout: 300000 // 5 minutes timeout
            });

            if (withdrawResponse.status === 200 || withdrawResponse.status === 201) {
                console.log("Withdraw API call successful:", withdrawResponse.data);
                return res.status(200).send(
                    Response.sendResponse(
                        true,
                        {
                            sub_entity_id: sub_entity.sub_entity_id,
                            entity_id: sub_entity.entity_id,
                            amount: withdrawAmount,
                            withdrawResponse: withdrawResponse.data
                        },
                        "Token withdraw successful",
                        200
                    )
                );
            } else {
                console.error("Withdraw API returned unexpected status:", withdrawResponse.status);
                return res.status(withdrawResponse.status || 500).send(
                    Response.sendResponse(
                        false,
                        null,
                        withdrawResponse.data?.message || "Withdraw failed",
                        withdrawResponse.status || 500
                    )
                );
            }
        } catch (withdrawError) {
            console.error("Withdraw API call failed:", withdrawError.response?.data || withdrawError.message);
            return res.status(withdrawError.response?.status || 500).send(
                Response.sendResponse(
                    false,
                    null,
                    withdrawError.response?.data?.message || withdrawError.message || "Withdraw failed",
                    withdrawError.response?.status || 500
                )
            );
        }

    } catch (error) {
        console.error("Withdraw token error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

const getSubEntityByEmail = async (req, res) => {
    try {
        const { email_id } = req.body;
        if (!email_id) {
            return res.status(400).send(Response.sendResponse(false, null, "email_id is required", 400));
        }
        const sub_entity = await db.tbl_sub_entity.findOne({ where: { email_id } });
        if (!sub_entity) {
            return res.status(404).send(Response.sendResponse(false, null, "Sub-entity not found", 404));
        }
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.findOne({
            where: { sub_entity_id: sub_entity.sub_entity_id },
            attributes: { exclude: ['encrypted_private_key'] }
        });
        if (!sub_entity_wallet) {
            return res.status(404).send(Response.sendResponse(false, null, "Sub-entity wallet not found", 404));
        }

        // Decrypt private key for balance calculation
        let subEntityPrivateKey = null;
        try {
            const subEntityWalletWithKey = await db.tbl_sub_entities_wallets.findOne({
                where: { sub_entity_id: sub_entity.sub_entity_id },
                attributes: ['encrypted_private_key']
            });
            if (subEntityWalletWithKey && subEntityWalletWithKey.encrypted_private_key) {
                subEntityPrivateKey = decryptPrivateKey(subEntityWalletWithKey.encrypted_private_key);
            }
        } catch (err) {
            console.log(`Failed to decrypt sub-entity ${sub_entity.sub_entity_id} private key:`, err.message);
        }

        // Get balances
        const [avaxBalance, eusdcBalance] = await Promise.all([
            getAvaxBalance(sub_entity_wallet.address),
            getEusdcBalance(sub_entity_wallet.address, subEntityPrivateKey)
        ]);

        // Prepare response with balances
        const responseData = {
            sub_entity,
            sub_entity_wallet,
            balances: {
                avax: avaxBalance,
                eusdc: eusdcBalance
            }
        };

        return res.status(200).send(Response.sendResponse(true, responseData, "Sub-entity fetched successfully", 200));
    } catch (error) {
        return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
    }
};

const transferToken = async (req, res) => {
    try {
        const { sub_entity_id, tokenType, recipient, amount } = req.body;
        const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

        // Validate x-secret-key header
        if (!secretKey) {
            return res.status(400).send(
                Response.sendResponse(false, null, "x-secret-key header is required", 400)
            );
        }

        // Validate amount
        if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
            return res.status(400).send(
                Response.sendResponse(false, null, "Valid amount is required", 400)
            );
        }

        // Get sub-entity
        const sub_entity = await db.tbl_sub_entity.findOne({ where: { sub_entity_id } });
        if (!sub_entity) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity not found", 404)
            );
        }

        // Get parent entity and validate API key
        const entity = await db.tbl_entities.findOne({
            where: { entity_id: sub_entity.entity_id, api_key: secretKey }
        });
        if (!entity) {
            return res.status(401).send(
                Response.sendResponse(false, null, "Invalid Api Key or Sub-entity not found", 401)
            );
        }

        // Get sub-entity wallet
        const sub_entity_wallet = await db.tbl_sub_entities_wallets.findOne({
            where: { sub_entity_id }
        });

        if (!sub_entity_wallet) {
            return res.status(404).send(
                Response.sendResponse(false, null, "Sub-entity wallet not found", 404)
            );
        }

        // Decrypt private key
        let decryptedPrivateKey;
        try {
            decryptedPrivateKey = decryptPrivateKey(sub_entity_wallet.encrypted_private_key);
        } catch (err) {
            console.log("Private key decryption failed:", err.message);
            return res.status(500).send(
                Response.sendResponse(false, null, "Failed to decrypt private key", 500)
            );
        }

        const tokenTypeUpper = tokenType.toUpperCase();
        let transferResult;

        if (tokenTypeUpper === 'AVAX') {
            try {
                console.log(`[Sub-Entity AVAX Transfer] Starting transfer for sub_entity_id: ${sub_entity_id}`);
                console.log(`[Sub-Entity AVAX Transfer] From: ${sub_entity_wallet.address}, To: ${recipient}, Amount: ${amount}`);

                // Provider + Wallet (exact same as test.js)
                const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
                const wallet = new ethers.Wallet(decryptedPrivateKey, provider);

                const sender = wallet.address;
                console.log(`[Sub-Entity AVAX Transfer] Sender: ${sender}`);
                console.log(`[Sub-Entity AVAX Transfer] Recipient: ${recipient}`);
                console.log(`[Sub-Entity AVAX Transfer] Amount: ${amount} AVAX`);

                // Convert AVAX → wei (exact same as test.js)
                const amountWei = ethers.parseEther(amount.toString());

                // Check balance (exact same as test.js)
                const balance = await provider.getBalance(sender);
                console.log(`[Sub-Entity AVAX Transfer] Balance: ${ethers.formatEther(balance)} AVAX`);

                if (balance < amountWei) {
                    console.error(`[Sub-Entity AVAX Transfer] Not enough balance to cover amount.`);
                    return res.status(400).send(
                        Response.sendResponse(false, null,
                            `Insufficient balance. Required: ${ethers.formatEther(amountWei)} AVAX, Available: ${ethers.formatEther(balance)} AVAX`, 400)
                    );
                }

                // Gas estimate (simple transfer) - exact same as test.js
                let gasLimit = await provider.estimateGas({
                    from: sender,
                    to: recipient,
                    value: amountWei
                });

                // Add small buffer - exact same as test.js
                gasLimit += 10000n;

                // Fetch gasPrice (Avalanche uses legacy gas) - exact same as test.js
                const fee = await provider.getFeeData();
                const gasPrice = fee.gasPrice;

                if (!gasPrice) {
                    throw new Error("Could not fetch gasPrice");
                }

                console.log(`[Sub-Entity AVAX Transfer] Gas Limit: ${gasLimit.toString()}`);
                console.log(`[Sub-Entity AVAX Transfer] Gas Price: ${gasPrice.toString()}`);

                const gasCost = gasLimit * gasPrice;
                console.log(`[Sub-Entity AVAX Transfer] Gas Cost: ${ethers.formatEther(gasCost)} AVAX`);

                // Ensure balance covers amount + gas - exact same as test.js
                if (balance < amountWei + gasCost) {
                    console.error(`[Sub-Entity AVAX Transfer] Not enough balance for amount + gas.`);
                    return res.status(400).send(
                        Response.sendResponse(false, null,
                            `Insufficient balance for gas. Total required: ${ethers.formatEther(amountWei + gasCost)} AVAX, Available: ${ethers.formatEther(balance)} AVAX`,
                            400
                        )
                    );
                }

                // Build tx - exact same as test.js
                const tx = {
                    to: recipient,
                    value: amountWei,
                    gasLimit,
                    gasPrice
                };

                console.log(`[Sub-Entity AVAX Transfer] Sending transaction...`);
                const sentTx = await wallet.sendTransaction(tx);

                console.log(`[Sub-Entity AVAX Transfer] Tx Hash: ${sentTx.hash}`);

                // Wait for confirmation - exact same as test.js
                const receipt = await sentTx.wait(1);

                console.log(`[Sub-Entity AVAX Transfer] Transaction Confirmed!`);
                console.log(`[Sub-Entity AVAX Transfer] Block: ${receipt.blockNumber}`);
                console.log(`[Sub-Entity AVAX Transfer] Status: ${receipt.status}`);
                console.log(`[Sub-Entity AVAX Transfer] Explorer: https://snowtrace.io/tx/${sentTx.hash}`);

                transferResult = {
                    success: true,
                    transactionHash: receipt.hash,
                    from: wallet.address,
                    to: recipient,
                    amount: amount,
                    gasUsed: receipt.gasUsed.toString(),
                    blockNumber: receipt.blockNumber,
                    status: receipt.status === 1 ? "success" : "failed"
                };

                console.log(`[Sub-Entity AVAX Transfer] Transfer completed`);
            } catch (error) {
                console.error(`[Sub-Entity AVAX Transfer] Error:`, error);
                return res.status(500).send(
                    Response.sendResponse(false, null, `AVAX transfer failed: ${error.message}`, 500)
                );
            }
        } else if (tokenTypeUpper === 'USDC') {
            // Transfer USDC (ERC20 token)
            try {
                const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
                const wallet = new ethers.Wallet(decryptedPrivateKey, provider);

                // USDC contract address on Avalanche
                const usdcAddress = process.env.USDC_CONTRACT_ADDRESS || "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";

                // ERC20 ABI for transfer function
                const erc20ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function decimals() view returns (uint8)"
                ];

                const tokenContract = new ethers.Contract(usdcAddress, erc20ABI, wallet);

                // Get token decimals
                const decimals = await tokenContract.decimals();

                // Convert amount to token units (6 decimals for USDC)
                const amountInUnits = ethers.parseUnits(amount.toString(), decimals);

                // Estimate gas
                const gasEstimate = await tokenContract.transfer.estimateGas(recipient, amountInUnits);

                // Send transaction
                const tx = await tokenContract.transfer(recipient, amountInUnits, {
                    gasLimit: gasEstimate
                });

                // Wait for transaction to be mined
                const receipt = await tx.wait();

                transferResult = {
                    success: true,
                    transactionHash: receipt.hash,
                    from: wallet.address,
                    to: recipient,
                    tokenAddress: usdcAddress,
                    amount: amount,
                    gasUsed: receipt.gasUsed.toString(),
                    blockNumber: receipt.blockNumber
                };
            } catch (error) {
                console.error("Sub-Entity USDC transfer error:", error);
                return res.status(500).send(
                    Response.sendResponse(false, null, `USDC transfer failed: ${error.message}`, 500)
                );
            }
        } else if (tokenTypeUpper === 'EUSDC') {
            // Transfer eUSDC using executeERC20Transfer utility function
            try {
                const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS || "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";

                // Get chain ID from wallet or environment
                const chainId = sub_entity_wallet.chain_id ?
                    (sub_entity_wallet.chain_id.includes("43113") ? 43113 : 43114) :
                    (process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 43114);

                // Use executeERC20Transfer utility function
                const txHash = await executeERC20Transfer(
                    sub_entity_wallet,
                    recipient,
                    amount,
                    tokenAddress,
                    chainId
                );

                if (!txHash) {
                    return res.status(500).send(
                        Response.sendResponse(
                            false,
                            null,
                            "eUSDC transfer failed",
                            500
                        )
                    );
                }

                transferResult = {
                    success: true,
                    transactionHash: txHash,
                    from: sub_entity_wallet.address,
                    to: recipient,
                    tokenAddress: tokenAddress,
                    amount: amount
                };
            } catch (transferError) {
                console.error("Sub-Entity eUSDC transfer error:", transferError);
                return res.status(500).send(
                    Response.sendResponse(
                        false,
                        null,
                        transferError.message || "eUSDC transfer failed",
                        500
                    )
                );
            }
        }

        // Return success response
        return res.status(200).send(
            Response.sendResponse(
                true,
                {
                    sub_entity_id: sub_entity.sub_entity_id,
                    entity_id: sub_entity.entity_id,
                    tokenType: tokenTypeUpper,
                    recipient: recipient,
                    amount: amount,
                    ...transferResult
                },
                "Token transfer successful",
                200
            )
        );

    } catch (error) {
        console.error("Sub-Entity transfer token error:", error);
        return res.status(500).send(
            Response.sendResponse(false, null, error.message, 500)
        );
    }
};

module.exports = {
    registerSubEntity,
    verifySubEntity,
    resendVerificationToken,
    depositToken,
    withdrawToken,
    getSubEntityByEmail,
    transferToken
}