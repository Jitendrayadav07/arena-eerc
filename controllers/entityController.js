const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
const { ethers } = require("ethers");
require("dotenv").config();
const ENTITY_CONSTANTS = require("../constants/entityConstants");

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

const registerEntity = async (req, res) => {
  try {
    const { email_id, name, entity_type, base_token } = req.body;

    if (!email_id || !name) {
      return res.status(400).send(Response.sendResponse(false,null,ENTITY_CONSTANTS.INVALID_PAYLOAD,400));
    }

    const existing = await db.tbl_entities.findOne({ where: { email_id } });
    if (existing) {
      return res.status(409).send(Response.sendResponse(false,null,ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS,409));
    }

    const api_key = crypto.randomBytes(32).toString("hex");

    // Generate a new EVM wallet
    const wallet = ethers.Wallet.createRandom();
    const walletAddress = wallet.address;
    const privateKey = wallet.privateKey;
    
    // Encrypt the private key
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    // Create entity
    const entity = await db.tbl_entities.create({
      name,
      email_id,
      api_key,
      entity_type,
      base_token
    });

    // Create wallet for the entity
    await db.tbl_wallets.create({
      entity_id: entity.entity_id,
      address: walletAddress,
      encrypted_private_key: encryptedPrivateKey,
      network: process.env.CHAIN_NAME || "avalanche-fuji",
      chain_id: process.env.CHAIN_ID?.toString() || "eip155:43113",
    });

    return res.status(200).send(Response.sendResponse(true,entity,ENTITY_CONSTANTS.ENTITY_CREATED,200));
  } catch (error) {
    return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
  }
};

module.exports = {
  registerEntity,
  decryptPrivateKey
}