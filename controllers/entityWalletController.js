const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
require("dotenv").config();
const ENTITY_WALLET_CONSTANTS = require("../constants/entityWalletConstants");

const THIRDWEB_BASE_URL = "https://api.thirdweb.com/v1";

const createEntityWallet = async (req, res) => {
  try {
    const entity_id = req.body.entity_id;
    console.log("entity_id",entity_id)
    const api_key = req.headers["x-api-key"];

    if (!entity_id || !api_key) {
      return res.status(400).send(Response.sendResponse(false,null,ENTITY_WALLET_CONSTANTS.INVALID_PAYLOAD,400));
    }

    const entity = await db.tbl_entities.findOne({where: { entity_id, api_key }});
    console.log("entity",entity)
    if (!entity) {
        return res.status(401).send(
          Response.sendResponse(false, null, "Invalid Api Key", 401)
        );
    }
    const existingWallet = await db.tbl_wallets.findOne({where: { entity_id }});
    console.log("existingWallet",existingWallet)
    if (existingWallet) {
      return res.status(409).send(Response.sendResponse(true,existingWallet,ENTITY_WALLET_CONSTANTS.WALLET_ALREADY_EXISTS,409));
    }

    const identifier = `entity-${entity_id}`; 

    const twResponse = await axios.post(
      `${THIRDWEB_BASE_URL}/wallets/server`,
      {
        identifier,
      },
      {
        headers: {
          "x-secret-key": process.env.THIRDWEB_SECRET_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Thirdweb create server:", twResponse.data);
    console.log("Thirdweb create server wallet response:",twResponse.data.result.profiles);

    const result = twResponse.data?.result || twResponse.data;
    const transfer_server_wallet_address = result.smartWalletAddress;
    console.log("existingWallet",transfer_server_wallet_address)
    const send_address = result.address;
    console.log("send_address",send_address)
    const wallet = await db.tbl_wallets.create({
      entity_id,
      server_wallet_identifier: identifier,
      transfer_server_wallet_address,
      send_address,
      network: process.env.CHAIN_NAME || "avalanche-fuji",
      chain_id: process.env.CHAIN_ID?.toString() || "43113",
    });

    return res.status(201).send(Response.sendResponse(true,wallet,ENTITY_WALLET_CONSTANTS.WALLET_CREATED,201));
  } catch (error) {
    return res.status(500).send(Response.sendResponse(false,null,error.response?.data || error.message,500));
  }
};

module.exports = {
  createEntityWallet,
};
