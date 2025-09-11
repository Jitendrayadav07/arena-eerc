// index.js
const express = require("express");
const router = express.Router();

const roleRoutes = require("./role");
// const twitterUser = require("./twitterUser");

router.use("/role", roleRoutes);
// router.use("/twitter", twitterUser);


module.exports = router;