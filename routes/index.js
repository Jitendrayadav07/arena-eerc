// index.js
const express = require("express");
const router = express.Router();

// Import route handlers
const arenaTokenRoute = require("./arenaTokenRoute");
const twitterRoute = require("./twitterRoute");
const userRoutes = require("./userRoutes");
const entityRoute = require("./entityRoute");
const entityWalletRoute = require("./entityWalletRoute");
const entityTransaction = require("./entityTransaction");
const subEntityRoute = require("./subEntityRoute");
const googleSuccess = require("./google_auth")

router.use("/arena-token", arenaTokenRoute);
router.use("/twitter", twitterRoute);
router.use("/user", userRoutes);
router.use("/entities", entityRoute);
router.use("/wallets", entityWalletRoute);
router.use("/transactions", entityTransaction);
router.use("/sub-entities", subEntityRoute);
router.use("/auth", googleSuccess);

module.exports = router;