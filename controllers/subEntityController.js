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

// Helper function to encrypt private key
const encryptPrivateKey = (privateKey) => {
    const algorithm = 'aes-256-gcm';
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return encrypted data with IV and auth tag (format: iv:authTag:encrypted)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

// Helper function to decrypt private key
const decryptPrivateKey = (encryptedData) => {
    const algorithm = 'aes-256-gcm';
    const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

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

module.exports = {
    registerSubEntity,
    decryptPrivateKey,
    verifySubEntity,
    resendVerificationToken
}