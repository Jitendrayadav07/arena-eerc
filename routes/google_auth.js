const express = require("express");
const router = express.Router();
const passport = require("passport");
const { JWT_SECRET } = require("../config/jwtTokenKey");
const jwt = require("jsonwebtoken");
require("dotenv").config();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login/failed",
  }),
  async (req, res) => {
    try {
      const user_data = req.user;
      if (user_data) {
        const token = jwt.sign(
          {
            email_id: user_data.emails[0].value,
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        const CLIENT_URL = `http://localhost:8081/userDetails?email=${encodeURIComponent(user_data.emails[0].value)}`;;
        res.redirect(CLIENT_URL);
      } else {
        res.status(404).json({ message: "User not found" });
      }
    } catch (error) {
      console.error("Error during Google callback:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

module.exports = router;