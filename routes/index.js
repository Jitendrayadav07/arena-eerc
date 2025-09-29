// index.js
const express = require("express");
const router = express.Router();

// Import route handlers
const arenaTokenRoute = require("./arenaTokenRoute");
const twitterRoute = require("./twitterRoute");
const userRoutes = require("./userRoutes");

router.use("/arena-token", arenaTokenRoute);
router.use("/twitter", twitterRoute);
router.use("/user", userRoutes);

module.exports = router;