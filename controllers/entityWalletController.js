const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto"); 
const axios = require("axios");
require("dotenv").config();
const ENTITY_WALLET_CONSTANTS = require("../constants/entityWalletConstants");

const THIRDWEB_BASE_URL = "https://api.thirdweb.com/v1"; 

const createEntityWallet = async (req, res) => {
    try {
      const { entity_id, network } = req.body;
  
      if (!entity_id) {
        return res.status(400).send(Response.sendResponse(false, null, ENTITY_WALLET_CONSTANTS.INVALID_PAYLOAD, 400));
      }

      const entity = await db.tbl_entities.findOne({ where: { entity_id } });
      if (!entity) {
        return res
          .status(404)
          .send(Response.sendResponse(false, null, ENTITY_WALLET_CONSTANTS.ENTITY_NOT_FOUND, 404));
      }
      const email = entity.email_id;

      // ---------- Create wallet from Thirdweb ----------
      const twResponse = await axios.post(
        `${THIRDWEB_BASE_URL}/wallets/user`,
        { type: "email", email },
        {
          headers: {
            "Content-Type": "application/json",
            "x-secret-key": process.env.THIRDWEB_SECRET_KEY,
          },
        }
      );
      console.log("Thirdweb wallet creation response:", twResponse.data);

      const wallet_address = twResponse.data.result.address;
      const eerc_user_id = twResponse.data.result.userId;

      const response = await db.tbl_wallets.create({
        entity_id,
        onchain_address: wallet_address,
        network: network,
        eerc_user_id,
      });
  
      return res.status(201).send(
        Response.sendResponse(
          true,
          response,
          "Entity Wallet Created Successfully",
          201
        )
      );
    } catch (error) {
      console.error("Create wallet error:", error.response?.data || error.message);
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
    createEntityWallet,
    
}