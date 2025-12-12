const crypto = require("crypto");
require("dotenv").config();

/**
 * Helper function to decrypt private key
 * @param {string} encryptedData - Encrypted private key in format: iv:authTag:encrypted
 * @returns {string} Decrypted private key
 */
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

/**
 * Helper function to encrypt private key
 * @param {string} privateKey - Private key to encrypt
 * @returns {string} Encrypted private key in format: iv:authTag:encrypted
 */
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

module.exports = {
  decryptPrivateKey,
  encryptPrivateKey
};

