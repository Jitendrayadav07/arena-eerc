const express = require("express");
const router = express.Router();

const arenaTokenController = require("../controllers/arenaTokenController");
const arenaTokenValidation = require("../validations/arenaTokenValidation");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");


router.post("/create-arena-token", 
    arenaTokenController.createArenaToken
);

router.post("/get-arena-pro-balances", 
    arenaTokenController.getArenaProTokenBalances
);

module.exports = router;