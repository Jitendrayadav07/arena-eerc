const express = require("express");
const router = express.Router();

const entityWalletController = require("../controllers/entityWalletController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const entityWalletSchema = require("../validations/walletValidations");

router.post("/",
  JoiMiddleWare(entityWalletSchema.createEntityWalletValidation, "body"),
  entityWalletController.createEntityWallet
);


module.exports = router;
