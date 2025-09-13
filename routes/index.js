// index.js
const express = require("express");
const router = express.Router();

const arenaTokenRoutes = require("./arena_token");

router.use("/arena-token", arenaTokenRoutes);


module.exports = router;