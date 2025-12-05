const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto"); 
const axios = require("axios");
const ENTITY_CONSTANTS = require("../constants/entityConstants");

const registerEntity = async (req, res) => {
  try {
    const { email_id , name } = req.body;

    if (!email_id || !name) {
        return res.status(400).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.INVALID_PAYLOAD, 400));
    }

    const existing = await db.tbl_entities.findOne({ where: { email_id } });
    if (existing) {
      return res.status(409).send(Response.sendResponse(false, null, ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS, 409));
    }

    const api_key = crypto.randomBytes(32).toString("hex"); 

    const response = await db.tbl_entities.create({name,email_id,api_key});

    return res.status(200).send(Response.sendResponse(true, response, ENTITY_CONSTANTS.ENTITY_CREATED, 200));
  } catch (error) {
    return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
  }
};

const transferTransaction = async (req, res) => {
    try {
      const { from_wallet_address, to_wallet_address, amount } = req.body;
      
      if (!from_wallet_address || !to_wallet_address || !amount) {
        return res.status(400).send(
          Response.sendResponse(
            false,
            null,
            "from_wallet_address, to_wallet_address and amount are required",
            400
          )
        );
      }
  
      // GET sender wallet from DB
      const sender = await db.tbl_wallets.findOne({
        where: { onchain_address: from_wallet_address }
      });
  
      if (!sender) {
        return res.status(404).send(
          Response.sendResponse(false, null, "Sender wallet not found", 404)
        );
      }
  
      // chainId based on network
      const chainId = sender.network === "avalanche-fuji" ? 43113 : 43114;
  
      // Convert AVAX → wei
      const valueWei = BigInt(amount * 1e18).toString();
  
      // Thirdweb Engine signing call
      const tx = await axios.post(
        "https://api.thirdweb.com/v1/engine/transactions/send",
        {
          user: sender.eerc_user_id,
          key: sender.eerc_key_id,
          chainId,
          to: to_wallet_address,
          value: valueWei,
          data: "0x"
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-secret-key": process.env.THIRDWEB_SECRET_KEY
          }
        }
      );
  
      const txHash = tx.data?.result?.transactionHash;
  
      return res.status(200).send(
        Response.sendResponse(
          true,
          {
            transaction_hash: txHash,
            from: from_wallet_address,
            to: to_wallet_address,
            explorer: `https://testnet.snowtrace.io/tx/${txHash}`
          },
          "Transfer successful",
          200
        )
      );
    } catch (error) {
      console.error("TX Error:", error.response?.data || error.message);
      return res
        .status(500)
        .send(
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
  registerEntity,
  transferTransaction
}