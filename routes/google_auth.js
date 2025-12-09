const express = require("express");
const router = express.Router();
const passport = require("passport");
const { JWT_SECRET } = require("../config/jwtTokenKey");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const CLIENT_URL = `${process.env.REDIRECT_URL}/v1/auth/google/success`;

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login/failed" }),
  async (req, res) => {
    try {
      const user_data = req.user; // This is DB user, not Google profile

      if (!user_data) {
        console.log("User undefined!");
        return res.status(500).json({ message: "User undefined" });
      }

      const token = jwt.sign(
        {
          id: user_data.id,
          email: user_data.email,
          google_id: user_data.google_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      console.log("Generated Token:", token);

      return res.redirect(
        `${CLIENT_URL}?token=${token}`
      );
    } catch (error) {
      console.error("Error during Google callback:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

router.get("/google/success", (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: "Token missing" });
  }

  res.json({
    success: true,
    message: "Google login successful",
    token
  });
});

module.exports = router;