const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

router.get("/wallet", userController.getUserWallet);

module.exports = router;