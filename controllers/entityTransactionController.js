// controllers/entityTransactionController.js
const axios = require("axios");
const Response = require("../classes/Response");
const db = require("../config/db.config");
const { ethers } = require("ethers");
const TRANSACTION = require("../constants/transactionConstants");
const { decryptPrivateKey } = require("../utils/cryptoUtils");
require("dotenv").config();
const { Op, QueryTypes, Sequelize } = require("sequelize");

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

const sendFromEntityWallet = async (req, res) => {
  try {
    const { entity_id, to, amount } = req.body;

    if (!entity_id || !to || !amount) {
      return res
        .status(400)
        .send(
          Response.sendResponse(false, null, TRANSACTION.INVALID_PAYLOAD, 400)
        );
    }

    const entity = await db.tbl_entities.findOne({ where: { entity_id } });

    if (!entity) {
      return res
        .status(404)
        .send(
          Response.sendResponse(
            false,
            null,
            TRANSACTION.NOT_FOUND,
            404
          )
        );
    }

    const wallet = await db.tbl_wallets.findOne({ where: { entity_id } });
    if (!wallet) {
      return res
        .status(404)
        .send(
          Response.sendResponse(
            false,
            null,
            TRANSACTION.WALLET_NOT_FOUND,
            404
          )
        );
    }

    const chainId =
      process.env.CHAIN_ID?.toString() || wallet.chain_id || "43113";
    // Convert human-readable AVAX amount to wei
    const valueWei = ethers.parseEther(amount.toString()).toString();

    // Call thirdweb Transactions API
    const twResponse = await axios.post(
      `${THIRDWEB_BASE_URL}/transactions`,
      {
        chainId: Number(chainId), // or string, depending on docs; 43113 for Avalanche Fuji
        from: wallet.transfer_server_wallet_address, // important: use the company server wallet as sender
        gasless: true,
        transactions: [
          {
            to,
            value: valueWei,
            data: "0x", // simple native value transfer
            mode: "prepared"
          },
        ],
      },
      {
        headers: {
          "x-secret-key": process.env.THIRDWEB_SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const data = twResponse.data;

    // Optionally store tx in DB
    let savedTx = null;
    if (db.tbl_transactions) {
      const txId = data?.transactions?.[0]?.id || data?.id || null; // depends on response shape
      savedTx = await db.tbl_transactions.create({
        entity_id,
        from_address: wallet.transfer_server_wallet_address,
        to_address: to,
        amount: amount.toString(),
        chain_id: chainId.toString(),
        thirdweb_tx_id: txId,
        status: data?.status,
        raw_response: JSON.stringify(data),
      });
    }

    return res
      .status(201)
      .send(
        Response.sendResponse(
          true,
          savedTx || data,
          TRANSACTION.TX_QUEUED,
          201
        )
      );
  } catch (error) {
    return res.status(500).send(
      Response.sendResponse(
        false,
        null,
        error.response?.data || error.message,
        500
      )
    );
  }
};

const getTransactionsByEntityId = async (req, res) => {
  try {
    const { entity_id, sortBy, orderBy } = req.query;

    let order_key = ``
    if (sortBy && orderBy) {
      order_key = `ORDER BY ${sortBy} ${orderBy}`
    } else {
      order_key = ``
    }
    if (!entity_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, TRANSACTION.INVALID_PAYLOAD, 400)
      );
    }

    let transaction_count = await db.sequelize.query(`SELECT COUNT(*) AS length FROM tbl_distributions WHERE entity_id = ${entity_id}`, { type: db.sequelize.QueryTypes.SELECT });
    length = transaction_count[0].length;

    // const transactions = await db.tbl_distributions.findAll({ where: { entity_id }, order: [[sortBy, orderBy]] });
    let response = await db.sequelize.query(`SELECT * FROM tbl_distributions WHERE entity_id = ${entity_id} ${order_key}`, { type: db.sequelize.QueryTypes.SELECT });

    if (!response) {
      return res.status(404).send(
        Response.sendResponse(false, null, TRANSACTION.NOT_FOUND, 404)
      );
    }
    return res.status(200).send(
      Response.sendResponse(true, { response, length }, TRANSACTION.SUCCESS, 200)
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.response?.data || error.message, 500)
    );
  }
};

const getTransactionsByEmailId = async (req, res) => {
  try {
    const { email_id, sortBy, orderBy } = req.query;

    let order_key = ``
    if (sortBy && orderBy) {
      order_key = `ORDER BY ${sortBy} ${orderBy}`
    } else {
      order_key = ``
    }

    if (!email_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, TRANSACTION.INVALID_PAYLOAD, 400)
      );
    }

    // Get entity details first
    const entity = await db.tbl_entities.findOne({ where: { email_id } });

    if (!entity) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity not found", 404)
      );
    }

    const entity_id = entity.entity_id;

    let transaction_count = await db.sequelize.query("SELECT COUNT(*) AS entity_count FROM tbl_entities WHERE email_id = :email", { replacements: { email: email_id }, type: db.sequelize.QueryTypes.SELECT });
    length = transaction_count[0].entity_count;

    let response = await db.sequelize.query(`SELECT * FROM tbl_distributions WHERE entity_id = ${entity_id} ${order_key}`, { type: db.sequelize.QueryTypes.SELECT });

    if (!response) {
      return res.status(404).send(
        Response.sendResponse(false, null, TRANSACTION.NOT_FOUND, 404)
      );
    }
    return res.status(200).send(
      Response.sendResponse(true, { response, length }, TRANSACTION.SUCCESS, 200)
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.response?.data || error.message, 500)
    );
  }
};

const getDashboardData = async (req, res) => {
  try {
    const { email_id } = req.query;

    if (!email_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, "Invalid payload", 400)
      );
    }

    // Find entity
    const entity = await db.tbl_entities.findOne({ where: { email_id } });

    if (!entity) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity not found", 404)
      );
    }

    const entity_id = entity.entity_id;

    // Get wallet address
    const wallet = await db.tbl_wallets.findOne({ where: { entity_id } });

    const walletAddress = wallet?.address || null;

    let balance = 0;
    if (walletAddress) {
      try {
        const balanceFromChain = await getAvaxBalance(walletAddress);
        balance = balanceFromChain?.balance || 0;
      } catch {
        balance = 0;
      }
    }

    // Transaction Count
    const [[{ totalTransactions }]] = await db.sequelize.query(
      `SELECT COUNT(*) AS totalTransactions
       FROM tbl_distributions WHERE entity_id = :entity_id`,
      { replacements: { entity_id } }
    );

    // Completed Count
    const [[{ completedTransactions }]] = await db.sequelize.query(
      `SELECT COUNT(*) AS completedTransactions
       FROM tbl_distributions
       WHERE entity_id = :entity_id AND status = 'COMPLETED'`,
      { replacements: { entity_id } }
    );

    const [[{ entityCount }]] = await db.sequelize.query(
      `SELECT COUNT(*) AS entityCount
       FROM tbl_entities
       WHERE email_id = :email`,
      { replacements: { email: email_id } }
    );

    // Success %
    const successRate = totalTransactions > 0 ? ((completedTransactions / totalTransactions) * 100).toFixed(2) : "0.00";

    return res.status(200).send(Response.sendResponse(true,
      {
        entity_count: entityCount,
        total_transactions: totalTransactions,
        completed_transactions: completedTransactions,
        success_rate: successRate,
        balance
      },
      "SUCCESS",
      200
    )
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.message, 500)
    );
  }
};

const getEntityBalance = async (req, res) => {
  try {
    const { email_id } = req.query;

    if (!email_id) {
      return res.status(400).send(
        Response.sendResponse(false, null, TRANSACTION.INVALID_PAYLOAD, 400)
      );
    }

    const entity = await db.tbl_entities.findOne({ where: { email_id } });

    if (!entity) {
      return res.status(404).send(
        Response.sendResponse(false, null, "Entity not found", 404)
      );
    }

    const entity_id = entity.entity_id;

    // Get wallet address
    const wallet = await db.tbl_wallets.findOne({ where: { entity_id } });

    const walletAddress = wallet?.address || null;

    let balance = 0;
    if (walletAddress) {
      try {
        const balanceFromChain = await getAvaxBalance(walletAddress);
        balance = balanceFromChain?.balance || 0;
      } catch {
        balance = 0;
      }
    }


    return res.status(200).send(Response.sendResponse(true,
      {
        balance
      },
      "SUCCESS",
      200
    )
    );
  } catch (error) {
    console.log(error);
    return res.status(500).send(
      Response.sendResponse(false, null, error.message, 500)
    );
  }
};

// here i need avax, e.USDC, USDC balance
const getBalanceByWalletAddress = async (req, res) => {
  try {
    const { wallet_address } = req.query;
    if (!wallet_address) {
      return res.status(400).send(Response.sendResponse(false, null, TRANSACTION.INVALID_PAYLOAD, 400));
    }

    // 1. Try entity wallet first
    let wallet = await db.tbl_wallets.findOne({ where: { address: wallet_address } });
    let isEntity = true;

    // 2. If not found, try sub-entity wallet
    if (!wallet) {
      wallet = await db.tbl_sub_entities_wallets.findOne({ where: { address: wallet_address } });
      isEntity = false;
    }

    // 3. Not found anywhere
    if (!wallet) {
      return res.status(404).send(Response.sendResponse(false, null, "WALLET_NOT_FOUND", 404));
    }

    const { encrypted_private_key, ...walletData } = wallet.dataValues;
    let privateKey = null;

    try {
      privateKey = encrypted_private_key ? decryptPrivateKey(encrypted_private_key) : null;
    } catch (err) {
      console.log("Failed to decrypt private key:", err.message);
    }

    const [avaxBalance, eusdcBalance] = await Promise.all([
      getAvaxBalance(wallet.address),
      getEusdcBalance(wallet.address, privateKey)
    ]);

    return res.status(200).send(
      Response.sendResponse(
        true,
        {
          walletBalances: {
            avax: avaxBalance,
            eusdc: eusdcBalance
          }
        },
        "SUCCESS",
        200
      )
    );


  } catch (error) {
    console.log(error);
    return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
  }
};


module.exports = {
  sendFromEntityWallet,
  getTransactionsByEntityId,
  getTransactionsByEmailId,
  getDashboardData,
  getEntityBalance,
  getBalanceByWalletAddress
};
