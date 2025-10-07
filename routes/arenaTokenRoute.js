const express = require("express");
const router = express.Router();
const arenaTokenController = require("../controllers/arenTokenController");

router.get("/treasury-tokens", arenaTokenController.getTreasuryTokens);

router.get("/get-eerc-token-verified", arenaTokenController.getEercTokenVerified);

module.exports = router;