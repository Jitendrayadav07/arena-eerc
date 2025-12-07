// controllers/entityTransactionController.js
const axios = require("axios");
const Response = require("../classes/Response");
const db = require("../config/db.config");
const { ethers } = require("ethers");
const TRANSACTION = require("../constants/transactionConstants");

const THIRDWEB_BASE_URL = process.env.THIRDWEB_BASE_URL || "https://api.thirdweb.com/v1";

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
      console.log("Thirdweb send transaction response:", data);
  
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

module.exports = {
  sendFromEntityWallet,
};
