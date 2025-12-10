// routes/entityTransaction.js
const express = require("express");
const router = express.Router();
const entityTransactionController = require("../controllers/entityTransactionController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const entityTransactionSchema = require("../validations/entityTransactionValidation");

// body: { entity_id, to, amount }
router.post("/", entityTransactionController.sendFromEntityWallet);

router.get("/get-transaction-by-entity-id",
    JoiMiddleWare(entityTransactionSchema.getTransactionsByEntityIdValidation, 'query'),
    entityTransactionController.getTransactionsByEntityId);

router.get("/get-transaction-by-email-id",
    JoiMiddleWare(entityTransactionSchema.getTransactionsByEmailIdValidation, 'query'),
    entityTransactionController.getTransactionsByEmailId);

router.get("/get-dashboard-data",
    JoiMiddleWare(entityTransactionSchema.getDashboardDataValidation, 'query'),
    entityTransactionController.getDashboardData);

router.get("/get-entity-balance",
    JoiMiddleWare(entityTransactionSchema.getEntityBalanceValidation, 'query'),
    entityTransactionController.getEntityBalance);

router.get("/get-balance-by-wallet-address",
    JoiMiddleWare(entityTransactionSchema.getBalanceByWalletAddressValidation, 'query'),
    entityTransactionController.getBalanceByWalletAddress);

module.exports = router;
