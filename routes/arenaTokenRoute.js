const express = require("express");
const router = express.Router();
const arenaTokenController = require("../controllers/arenTokenController");

router.get("/", arenaTokenController.getAllEercArenaTokens);

router.get("/treasury-tokens", arenaTokenController.getTreasuryTokens);


module.exports = router;