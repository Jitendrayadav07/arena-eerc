const { WALLET_NOT_FOUND } = require("./entityWalletConstants");

const TRANSACTION_CONSTANTS_STATUS = {
    TRANSACTION_CREATED: "TRANSACTION registered successfully",
    TRANSACTION_UPDATED: "TRANSACTION updated successfully",
    TRANSACTION_DELETED: "TRANSACTION deleted successfully",
  
    EMAIL_ALREADY_EXISTS: "Email already registered",
    TRANSACTION_ALREADY_EXISTS: "TRANSACTION already exists",
    WALLET_NOT_FOUND: "Entity wallet not found",
    INVALID_PAYLOAD: "Name and email_id are required",
    NOT_FOUND: "TRANSACTION not found",
    TX_QUEUED: "TRANSACTION_QUEUED",
  
    ERROR_OCCURRED: "An error occurred! Please try again"
  };
  
module.exports = TRANSACTION_CONSTANTS_STATUS;
  