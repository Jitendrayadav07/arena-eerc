const express = require("express");
const router = express.Router();

const entityWalletController = require("../controllers/entityWalletController");

router.post("/",
  entityWalletController.createEntityWallet
);


module.exports = router;
