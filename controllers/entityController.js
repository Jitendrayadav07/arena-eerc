const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
const { ethers } = require("ethers");
require("dotenv").config();
const { generateUserToken } = require("../utils/jwtEntity");
const ENTITY_CONSTANTS = require("../constants/entityConstants");
const { createEntityEmailData } = require("../utils/createEntityEmailData");
const sendEmail = require("../utils/sendEmail");
const { JWT_EERCx402_SECRET } = require("../config/jwtTokenKey");
const jwt = require("jsonwebtoken");
const { executeERC20Transfer } = require("./facilitatorController");
const { decryptPrivateKey, encryptPrivateKey } = require("../utils/cryptoUtils");

// Helper function to get AVAX balance (native balance)
const getAvaxBalance = async (walletAddress) => {
  try {
    const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
    const balance = await provider.getBalance(walletAddress);
    const balanceInAvax = ethers.formatEther(balance);
    return {
      balance: balanceInAvax,
      balanceWei: balance.toString()
    };
  } catch (error) {
    console.error(`Error fetching AVAX balance for ${walletAddress}:`, error.message);
    return {
      balance: "0",
      balanceWei: "0",
      error: error.message
    };
  }
};

// Helper function to get eUSDC balance from API
const getEusdcBalance = async (walletAddress, privateKey = null) => {
  try {
    const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS || "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E";
    const chain = process.env.CHAIN || "mainnet";
    const eercContractAddress = process.env.EERC_CONTRACT_ADDRESS || "0x9c27E4709Aa5a60107CFC0b89bC8302AEA6c1Fed";
    const registrarAddress = process.env.REGISTRAR_ADDRESS || "0x0c20b74a6CC85CF574C8779a1af572942E5318e9";
    const balanceApiUrl = process.env.BALANCE_API_URL;

    // Build query parameters (always use GET request)
    const params = new URLSearchParams({
      tokenAddress: tokenAddress,
      accountAddress: walletAddress,
      chain: chain,
      eercContractAddress: eercContractAddress,
      registrarAddress: registrarAddress
    });

    // Add privateKey to query params if provided
    if (privateKey) {
      params.append('privateKey', privateKey);
    }

    const response = await axios.get(`${balanceApiUrl}?${params.toString()}`, {
      timeout: 30000 // 30 seconds timeout
    });

    // Handle encryptedBalance - it might be an object or a string
    // If it's an object, we can't decrypt it for other accounts, so use "0"
    let encryptedBalance = "0";
    if (response.data.encryptedBalance) {
      if (typeof response.data.encryptedBalance === 'string') {
        encryptedBalance = response.data.encryptedBalance;
      } else if (typeof response.data.encryptedBalance === 'object') {
        // If it's an object, we can't decrypt encrypted balance for other accounts
        // Use "0" as the balance value
        encryptedBalance = "0";
      }
    }

    // Format tokenBalance properly from tokenBalanceWei (eUSDC/USDC has 6 decimals)
    let tokenBalance = "0";
    const tokenBalanceWei = response.data.tokenBalanceWei || "0";
    if (tokenBalanceWei && tokenBalanceWei !== "0") {
      try {
        // Convert from wei (USDC/eUSDC uses 6 decimals)
        const balanceWeiBigInt = BigInt(tokenBalanceWei);
        const decimals = 6; // USDC/eUSDC uses 6 decimals
        const divisor = BigInt(10 ** decimals);
        const wholePart = balanceWeiBigInt / divisor;
        const fractionalPart = balanceWeiBigInt % divisor;

        if (fractionalPart === BigInt(0)) {
          tokenBalance = wholePart.toString();
        } else {
          // Format fractional part with leading zeros if needed
          const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
          // Remove trailing zeros
          const fractionalTrimmed = fractionalStr.replace(/0+$/, '');
          tokenBalance = fractionalTrimmed ? `${wholePart}.${fractionalTrimmed}` : wholePart.toString();
        }
      } catch (e) {
        // Fallback to API response if conversion fails
        tokenBalance = String(response.data.tokenBalance || "0");
      }
    } else if (response.data.tokenBalance) {
      // Fallback to API response if tokenBalanceWei is not available
      tokenBalance = String(response.data.tokenBalance);
    }

    // Format encryptedBalance properly from encryptedBalanceWei (eUSDC/USDC has 6 decimals)
    let formattedEncryptedBalance = "0";
    const encryptedBalanceWei = response.data.encryptedBalanceWei || "0";

    // First, try to get encryptedBalance from response data (might be a string or object)
    let encryptedBalanceValue = encryptedBalance;
    if (response.data.encryptedBalance && typeof response.data.encryptedBalance === 'string') {
      encryptedBalanceValue = response.data.encryptedBalance;
    }

    // Priority: Use encryptedBalanceWei if available (most accurate)
    if (encryptedBalanceWei && encryptedBalanceWei !== "0") {
      try {
        const encryptedWeiBigInt = BigInt(encryptedBalanceWei);
        // encryptedBalanceWei is in 18 decimals (like ETH/wei)
        // Convert to readable format with 8 decimal places
        const weiDecimals = 18;
        const displayDecimals = 8; // Display with 8 decimal places
        const weiDivisor = BigInt(10 ** weiDecimals);

        // Convert from 18 decimals to decimal number
        const wholePart = encryptedWeiBigInt / weiDivisor;
        const remainder = encryptedWeiBigInt % weiDivisor;

        // Format with 8 decimal places
        if (remainder === BigInt(0)) {
          formattedEncryptedBalance = wholePart.toString() + ".00000000";
        } else {
          // Convert remainder to 8 decimal places
          // Multiply remainder by 10^8 and divide by 10^18 to get 8 decimal places
          const fractionalMultiplier = BigInt(10 ** displayDecimals);
          const fractionalPart = (remainder * fractionalMultiplier) / weiDivisor;
          const fractionalStr = fractionalPart.toString().padStart(displayDecimals, '0');
          formattedEncryptedBalance = `${wholePart}.${fractionalStr}`;
        }
      } catch (e) {
        // Fallback: try to format from encryptedBalance string
        try {
          if (encryptedBalanceValue && encryptedBalanceValue !== "0") {
            const encryptedBigInt = BigInt(encryptedBalanceValue);
            const decimals = 6;
            const divisor = BigInt(10 ** decimals);
            const wholePart = encryptedBigInt / divisor;
            const fractionalPart = encryptedBigInt % divisor;

            if (fractionalPart === BigInt(0)) {
              formattedEncryptedBalance = wholePart.toString() + ".000000";
            } else {
              const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
              formattedEncryptedBalance = `${wholePart}.${fractionalStr}`;
            }
          } else {
            formattedEncryptedBalance = encryptedBalanceValue;
          }
        } catch (e2) {
          formattedEncryptedBalance = encryptedBalanceValue;
        }
      }
    } else if (encryptedBalanceValue && encryptedBalanceValue !== "0") {
      // If no encryptedBalanceWei but we have encryptedBalance string, format it
      try {
        const encryptedBigInt = BigInt(encryptedBalanceValue);
        const decimals = 6;
        const divisor = BigInt(10 ** decimals);
        const wholePart = encryptedBigInt / divisor;
        const fractionalPart = encryptedBigInt % divisor;

        if (fractionalPart === BigInt(0)) {
          formattedEncryptedBalance = wholePart.toString() + ".000000";
        } else {
          const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
          formattedEncryptedBalance = `${wholePart}.${fractionalStr}`;
        }
      } catch (e) {
        formattedEncryptedBalance = encryptedBalanceValue;
      }
    } else {
      formattedEncryptedBalance = encryptedBalanceValue;
    }

    // Return only the required fields in proper format (all as strings to match AVAX format)
    return {
      tokenBalance: tokenBalance,
      tokenBalanceWei: String(tokenBalanceWei),
      encryptedBalance: formattedEncryptedBalance,
      encryptedBalanceWei: String(encryptedBalanceWei),
      isRegistered: Boolean(response.data.isRegistered || false)
    };
  } catch (error) {
    console.error(`Error fetching eUSDC balance for ${walletAddress}:`, error.response?.data || error.message);
    return {
      tokenBalance: "0",
      tokenBalanceWei: "0",
      encryptedBalance: "0",
      encryptedBalanceWei: "0",
      isRegistered: false,
      error: error.response?.data || error.message
    };
  }
};

const registerEntity = async (req, res) => {
  try {
    const { email_id, name, entity_type, base_token } = req.body;

    if (!email_id || !name) {
      return res.status(400).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.INVALID_PAYLOAD, 400));
    }

    const existing = await db.tbl_entities.findOne({ where: { email_id } });
    if (existing) {
      return res.status(409).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS, 409));
    }

    const existingSubEntity = await db.tbl_sub_entity.findOne({ where: { email_id } });
    if (existingSubEntity) {
      return res.status(409).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS, 409));
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
    const entity_wallet = await db.tbl_wallets.create({
      entity_id: entity.entity_id,
      address: walletAddress,
      encrypted_private_key: encryptedPrivateKey,
      network: process.env.CHAIN_NAME || "avalanche-fuji",
      chain_id: process.env.CHAIN_ID?.toString() || "eip155:43113",
    });


    let token = generateUserToken(entity, entity_wallet);

    const emailData = createEntityEmailData(entity, token, entity_wallet.address);

    await sendEmail(entity.email_id, emailData.subject, emailData.templateName, emailData);


    return res.status(200).send(Response.sendResponse(true, entity, ENTITY_CONSTANTS.ENTITY_CREATED, 200));
  } catch (error) {
    return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
  }
};

const verifyEntity = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).send("Invalid verification link");
    }

    // Decode token
    const decoded = jwt.verify(token, JWT_EERCx402_SECRET);
    // Fetch entity
    const entity = await db.tbl_entities.findOne({
      where: { email_id: decoded.email_id, entity_id: decoded.entity_id }
    });
    if (!entity) return res.status(404).send("Entity not found");

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
    console.error("Verify entity error:", error);
    return res.redirect(process.env.AFTER_VERIFIED_REDIRECT_URL + "?status=failed");
  }
};

const resendVerificationToken = async (req, res) => {
  try {
    const { entity_id } = req.body;
    const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

    // Validate x-secret-key header
    if (!secretKey) {
      return res.status(400).send(
        Response.sendResponse(false, null, "x-secret-key header is required", 400)
      );
    }

    // Validate entity_id
    if (!entity_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, "entity_id is required", 400)
      );
    }

    // Get entity and validate API key
    const entity = await db.tbl_entities.findOne({ where: { entity_id, api_key: secretKey } });
    if (!entity) {
      return res.status(401).send(
        Response.sendResponse(false, null, "Invalid Api Key or Entity not found", 401)
      );
    }

    // Get entity wallet
    const entity_wallet = await db.tbl_wallets.findOne({
      where: { entity_id }
    });

    if (!entity_wallet) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity wallet not found", 404)
      );
    }

    // Generate new verification token
    const token = generateUserToken(entity, entity_wallet);

    // Create email data
    const emailData = createEntityEmailData(entity, token, entity_wallet.address);

    // Send verification email
    await sendEmail(entity.email_id, emailData.subject, emailData.templateName, emailData);

    return res.status(200).send(
      Response.sendResponse(
        true,
        {
          entity_id: entity.entity_id,
          email_id: entity.email_id,
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

const getAllEntities = async (req, res) => {
  try {
    const { email_id } = req.body;

    if (!email_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, "email_id is required", 400)
      );
    }

    // Get all entities for this email_id (findAll to match original structure)
    const entities = await db.tbl_entities.findAll({
      where: { email_id },
      order: [['createdAt', 'DESC']],
      attributes: ['entity_id', 'name', 'email_id', 'entity_type', 'base_token', 'createdAt']
    });

    if (!entities || entities.length === 0) {
      return res.status(200).send(
        Response.sendResponse(true, [], "No entities found for this email", 200)
      );
    }

    // Extract entity_ids
    const entityIds = entities.map(ent => ent.entity_id);

    // Fetch wallets for these entity_ids
    const wallets = await db.tbl_wallets.findAll({
      where: { entity_id: entityIds },
      attributes: ['entity_id', 'address', 'network', 'chain_id']
    });

    // Map entity_id → wallet
    const walletMap = {};
    wallets.forEach(wallet => {
      walletMap[wallet.entity_id] = wallet.address;
    });

    // Merge wallet address into entity object (same as original)
    const entitiesWithWalletAddress = entities.map(entity => {
      const entityData = entity.toJSON();
      return {
        ...entityData,
        wallet_address: walletMap[entity.entity_id] || null
      };
    });

    return res.status(200).send(
      Response.sendResponse(
        true,
        entitiesWithWalletAddress,
        "Entities retrieved successfully",
        200
      )
    );
  } catch (error) {
    console.error("Get all entities error:", error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.message, 500)
    );
  }
};


const getEntityById = async (req, res) => {
  try {
    const { entity_id } = req.params;

    if (!entity_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, ENTITY_CONSTANTS.INVALID_PAYLOAD, 400)
      );
    }

    // Get entity
    const entity = await db.tbl_entities.findOne({
      where: { entity_id }
    });

    if (!entity) {
      return res.status(404).send(
        Response.sendResponse(false, null, ENTITY_CONSTANTS.NOT_FOUND, 404)
      );
    }

    // Get entity wallet details (exclude encrypted_private_key)
    const wallet = await db.tbl_wallets.findOne({
      where: { entity_id },
      attributes: { exclude: ['encrypted_private_key'] }
    });

    // Get sub entities
    const subEntities = await db.tbl_sub_entity.findAll({
      where: { entity_id }
    });

    // Get sub entity IDs
    const subEntityIds = subEntities.map(subEntity => subEntity.sub_entity_id);

    // Get sub entity wallets (exclude encrypted_private_key)
    const subEntityWallets = subEntityIds.length > 0
      ? await db.tbl_sub_entities_wallets.findAll({
        where: { sub_entity_id: subEntityIds },
        attributes: { exclude: ['encrypted_private_key'] }
      })
      : [];

    // Get balances for entity wallet
    let entityWalletBalances = null;
    if (wallet && wallet.address) {
      // Decrypt private key for entity wallet
      let entityPrivateKey = null;
      try {
        const entityWalletWithKey = await db.tbl_wallets.findOne({
          where: { entity_id },
          attributes: ['encrypted_private_key']
        });
        if (entityWalletWithKey && entityWalletWithKey.encrypted_private_key) {
          entityPrivateKey = decryptPrivateKey(entityWalletWithKey.encrypted_private_key);
        }
      } catch (err) {
        console.log("Failed to decrypt entity private key:", err.message);
      }

      const [avaxBalance, eusdcBalance] = await Promise.all([
        getAvaxBalance(wallet.address),
        getEusdcBalance(wallet.address, entityPrivateKey)
      ]);
      entityWalletBalances = {
        avax: avaxBalance,
        eusdc: eusdcBalance
      };
    }

    // Map sub entity wallets to their sub entities (1 wallet per sub-entity)
    const subEntityWalletMap = {};
    subEntityWallets.forEach(wallet => {
      subEntityWalletMap[wallet.sub_entity_id] = wallet;
    });

    // Get balances for all sub entity wallets
    const subEntityWalletBalancesPromises = subEntityWallets.map(async (subWallet) => {
      // Decrypt private key for sub-entity wallet
      let subEntityPrivateKey = null;
      try {
        const subEntityWalletWithKey = await db.tbl_sub_entities_wallets.findOne({
          where: { sub_entity_id: subWallet.sub_entity_id },
          attributes: ['encrypted_private_key']
        });
        if (subEntityWalletWithKey && subEntityWalletWithKey.encrypted_private_key) {
          subEntityPrivateKey = decryptPrivateKey(subEntityWalletWithKey.encrypted_private_key);
        }
      } catch (err) {
        console.log(`Failed to decrypt sub-entity ${subWallet.sub_entity_id} private key:`, err.message);
      }

      const [avaxBalance, eusdcBalance] = await Promise.all([
        getAvaxBalance(subWallet.address),
        getEusdcBalance(subWallet.address, subEntityPrivateKey)
      ]);
      return {
        wallet_id: subWallet.wallet_id,
        address: subWallet.address,
        balances: {
          avax: avaxBalance,
          eusdc: eusdcBalance
        }
      };
    });

    const subEntityWalletBalances = await Promise.all(subEntityWalletBalancesPromises);

    // Create a map of wallet address to balances for quick lookup
    const walletBalanceMap = {};
    subEntityWalletBalances.forEach(walletBalance => {
      walletBalanceMap[walletBalance.address] = walletBalance.balances;
    });

    // Combine sub entities with their wallet and balances (single wallet, not array)
    const subEntitiesWithWallets = subEntities.map(subEntity => {
      const subEntityData = subEntity.toJSON();
      const subEntityWallet = subEntityWalletMap[subEntityData.sub_entity_id];

      if (subEntityWallet) {
        const walletData = subEntityWallet.toJSON();
        return {
          ...subEntityData,
          wallet: {
            ...walletData,
            balances: walletBalanceMap[walletData.address] || {
              avax: { balance: "0", balanceWei: "0" },
              eusdc: { tokenBalance: "0", tokenBalanceWei: "0", encryptedBalance: "0", encryptedBalanceWei: "0", isRegistered: false }
            }
          }
        };
      } else {
        return {
          ...subEntityData,
          wallet: null
        };
      }
    });

    // Combine entity with wallet, balances, and sub entities
    const entityData = entity.toJSON();
    const walletData = wallet ? {
      ...wallet.toJSON(),
      balances: entityWalletBalances
    } : null;

    const result = {
      ...entityData,
      wallet: walletData,
      sub_entities: subEntitiesWithWallets
    };

    return res.status(200).send(
      Response.sendResponse(
        true,
        result,
        "Entity retrieved successfully",
        200
      )
    );
  } catch (error) {
    console.error("Get entity by id error:", error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.message, 500)
    );
  }
};

const depositToken = async (req, res) => {
  try {
    const { entity_id, amount } = req.body;
    const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

    // Validate x-secret-key header
    if (!secretKey) {
      return res.status(400).send(
        Response.sendResponse(false, null, "x-secret-key header is required", 400)
      );
    }

    // Validate entity_id
    if (!entity_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, "entity_id is required", 400)
      );
    }

    // Validate amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).send(
        Response.sendResponse(false, null, "Valid amount is required", 400)
      );
    }

    // Get entity and validate API key
    const entity = await db.tbl_entities.findOne({ where: { entity_id, api_key: secretKey } });
    if (!entity) {
      return res.status(401).send(
        Response.sendResponse(false, null, "Invalid Api Key or Entity not found", 401)
      );
    }

    // Get entity wallet
    const entity_wallet = await db.tbl_wallets.findOne({
      where: { entity_id }
    });

    if (!entity_wallet) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity wallet not found", 404)
      );
    }

    // Decrypt private key
    let decryptedPrivateKey;
    try {
      decryptedPrivateKey = decryptPrivateKey(entity_wallet.encrypted_private_key);
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
              entity_id: entity.entity_id,
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
    const { entity_id, amount } = req.body;
    const secretKey = req.headers['x-secret-key'] || req.headers['X-SECRET-KEY'];

    // Validate x-secret-key header
    if (!secretKey) {
      return res.status(400).send(
        Response.sendResponse(false, null, "x-secret-key header is required", 400)
      );
    }

    // Validate entity_id
    if (!entity_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, "entity_id is required", 400)
      );
    }

    // Validate amount
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).send(
        Response.sendResponse(false, null, "Valid amount is required", 400)
      );
    }

    // Get entity and validate API key
    const entity = await db.tbl_entities.findOne({ where: { entity_id, api_key: secretKey } });
    if (!entity) {
      return res.status(401).send(
        Response.sendResponse(false, null, "Invalid Api Key or Entity not found", 401)
      );
    }

    // Get entity wallet
    const entity_wallet = await db.tbl_wallets.findOne({
      where: { entity_id }
    });

    if (!entity_wallet) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity wallet not found", 404)
      );
    }

    // Decrypt private key
    let decryptedPrivateKey;
    try {
      decryptedPrivateKey = decryptPrivateKey(entity_wallet.encrypted_private_key);
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
              entity_id: entity.entity_id,
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

const transferToken = async (req, res) => {
  try {
    const { entity_id, tokenType, recipient, amount } = req.body;
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

    // Get entity and validate API key
    const entity = await db.tbl_entities.findOne({ where: { entity_id, api_key: secretKey } });
    if (!entity) {
      return res.status(401).send(
        Response.sendResponse(false, null, "Invalid Api Key or Entity not found", 401)
      );
    }

    // Get entity wallet
    const entity_wallet = await db.tbl_wallets.findOne({
      where: { entity_id }
    });

    if (!entity_wallet) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity wallet not found", 404)
      );
    }

    // Decrypt private key
    let decryptedPrivateKey;
    try {
      decryptedPrivateKey = decryptPrivateKey(entity_wallet.encrypted_private_key);
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
        console.log(`[AVAX Transfer] Starting transfer for entity_id: ${entity_id}`);
        console.log(`[AVAX Transfer] From: ${entity_wallet.wallet_address}, To: ${recipient}, Amount: ${amount}`);
    
        // Provider + Wallet (exact same as test.js)
        const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
        const wallet = new ethers.Wallet(decryptedPrivateKey, provider);
    
        const sender = wallet.address;
        console.log(`[AVAX Transfer] Sender: ${sender}`);
        console.log(`[AVAX Transfer] Recipient: ${recipient}`);
        console.log(`[AVAX Transfer] Amount: ${amount} AVAX`);
    
        // Convert AVAX → wei (exact same as test.js)
        const amountWei = ethers.parseEther(amount.toString());
    
        // Check balance (exact same as test.js)
        const balance = await provider.getBalance(sender);
        console.log(`[AVAX Transfer] Balance: ${ethers.formatEther(balance)} AVAX`);
    
        if (balance < amountWei) {
          console.error(`[AVAX Transfer] Not enough balance to cover amount.`);
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
    
        console.log(`[AVAX Transfer] Gas Limit: ${gasLimit.toString()}`);
        console.log(`[AVAX Transfer] Gas Price: ${gasPrice.toString()}`);
    
        const gasCost = gasLimit * gasPrice;
        console.log(`[AVAX Transfer] Gas Cost: ${ethers.formatEther(gasCost)} AVAX`);
    
        // Ensure balance covers amount + gas - exact same as test.js
        if (balance < amountWei + gasCost) {
          console.error(`[AVAX Transfer] Not enough balance for amount + gas.`);
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
    
        console.log(`[AVAX Transfer] Sending transaction...`);
        const sentTx = await wallet.sendTransaction(tx);
    
        console.log(`[AVAX Transfer] Tx Hash: ${sentTx.hash}`);
    
        // Wait for confirmation - exact same as test.js
        const receipt = await sentTx.wait(1);
    
        console.log(`[AVAX Transfer] Transaction Confirmed!`);
        console.log(`[AVAX Transfer] Block: ${receipt.blockNumber}`);
        console.log(`[AVAX Transfer] Status: ${receipt.status}`);
        console.log(`[AVAX Transfer] Explorer: https://snowtrace.io/tx/${sentTx.hash}`);
    
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
    
        console.log(`[AVAX Transfer] Transfer completed`);
      } catch (error) {
        console.error(`[AVAX Transfer] Error:`, error);
        return res.status(500).send(
          Response.sendResponse(false, null, `AVAX transfer failed: ${error.message}`, 500)
        );
      }
    }
     else if (tokenTypeUpper === 'USDC') {
      // Transfer USDC (ERC20 token)
      try {
        const provider = new ethers.JsonRpcProvider("https://api.avax.network/ext/bc/C/rpc");
        const wallet = new ethers.Wallet(decryptedPrivateKey, provider);
        
        // USDC contract address on Avalanche (you may need to adjust this)
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
        console.error("USDC transfer error:", error);
        return res.status(500).send(
          Response.sendResponse(false, null, `USDC transfer failed: ${error.message}`, 500)
        );
      }
    } else if (tokenTypeUpper === 'EUSDC') {
      // Transfer eUSDC using executeERC20Transfer utility function
      try {
        const tokenAddress = process.env.TOKEN_CONTRACT_ADDRESS || "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7";
        
        // Get chain ID from wallet or environment
        const chainId = entity_wallet.chain_id ? 
          (entity_wallet.chain_id.includes("43113") ? 43113 : 43114) : 
          (process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID) : 43114);

        // Use executeERC20Transfer utility function
        const txHash = await executeERC20Transfer(
          entity_wallet,
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
          from: entity_wallet.address,
          to: recipient,
          tokenAddress: tokenAddress,
          amount: amount
        };
      } catch (transferError) {
        console.error("eUSDC transfer error:", transferError);
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
          entity_id: entity.entity_id,
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
    console.error("Transfer token error:", error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.message, 500)
    );
  }
};

module.exports = {
  registerEntity,
  verifyEntity,
  resendVerificationToken,
  getAllEntities,
  getEntityById,
  depositToken,
  withdrawToken,
  getAvaxBalance,
  getEusdcBalance,
  transferToken
}