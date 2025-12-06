// routes/entityTransaction.js
const express = require("express");
const router = express.Router();
const entityTransactionController = require("../controllers/entityTransactionController");

// body: { entity_id, to, amount }
router.post("/", entityTransactionController.sendFromEntityWallet);

module.exports = router;
