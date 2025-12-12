const axios = require("axios");
const { decryptPrivateKey } = require("./cryptoUtils");
require("dotenv").config();

/**
 * Execute ERC20 token transfer (eUSDC) using external transfer API endpoint
 * @param {Object} fromWallet - Wallet object with encrypted_private_key
 * @param {string} toAddress - Recipient address
 * @param {number|string} amount - Amount to transfer
 * @param {string} tokenContract - Token contract address
 * @param {number|string} chainId - Chain ID (optional, defaults to mainnet)
 * @returns {Promise<string|null>} Transaction hash or null if failed
 */
const executeERC20Transfer = async (fromWallet, toAddress, amount, tokenContract, chainId = null) => {
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
        let chain = "mainnet";
        if (chainId) {
            chain = chainId === 43113 ? "testnet" : "mainnet";
        }

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
        
        if (!transferApiUrl) {
            console.error("TRANSFER_API_URL environment variable not configured");
            return null;
        }

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

module.exports = {
    executeERC20Transfer
};

