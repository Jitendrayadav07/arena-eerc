// index.js
const express = require("express");
const router = express.Router();

// Import route handlers
const arenaTokenRoute = require("./arenaTokenRoute");
const twitterRoute = require("./twitterRoute");

router.use("/arena-token", arenaTokenRoute);
router.use("/twitter", twitterRoute);

module.exports = router;