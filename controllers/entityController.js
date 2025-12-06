const Response = require("../classes/Response");
const db = require("../config/db.config");
const crypto = require("crypto");
const axios = require("axios");
const ENTITY_CONSTANTS = require("../constants/entityConstants");

const registerEntity = async (req, res) => {
  try {
    const { email_id, name } = req.body;

    if (!email_id || !name) {
      return res.status(400).send(Response.sendResponse(false,null,ENTITY_CONSTANTS.INVALID_PAYLOAD,400));
    }

    const existing = await db.tbl_entities.findOne({ where: { email_id } });
    if (existing) {
      return res.status(409).send(Response.sendResponse(false,null,ENTITY_CONSTANTS.ENTITY_ALREADY_EXISTS,409));
    }

    const api_key = crypto.randomBytes(32).toString("hex");

    const entity = await db.tbl_entities.create({name,email_id,api_key});

    return res.status(200).send(Response.sendResponse(true,entity,ENTITY_CONSTANTS.ENTITY_CREATED,200));
  } catch (error) {
    return res.status(500).send(Response.sendResponse(false, null, error.message, 500));
  }
};

module.exports = {
  registerEntity
}