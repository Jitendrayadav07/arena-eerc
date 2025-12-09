const express = require("express");
const router = express.Router();
const passport = require("passport");
const { JWT_EERCx402_SECRET } = require("../config/jwtTokenKey");
const jwt = require("jsonwebtoken");
const db = require("../config/db.config");
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
      // Check if email exists in entity or subentity table to assign role
      let role = "entity"; // Default role
      
      // Check if email exists in entity table
      const entity = await db.tbl_entities.findOne({
        where: { email_id: user_data.email }
      });
      
      if (entity) {
        role = "entity";
      } else {
        // Check if email exists in subentity table
        const subEntity = await db.tbl_sub_entity.findOne({
          where: { email_id: user_data.email }
        });
        
        if (subEntity) {
          role = "subentity";
        }
        // If neither exists, role remains "entity" (default)
      }
      
      const token = jwt.sign(
        {
          id: user_data.id,
          email: user_data.email,
          google_id: user_data.google_id,
          role: role,
        },
        JWT_EERCx402_SECRET,
        { expiresIn: "24h" }
      );

      console.log("Generated Token:", token);

      return res.redirect(
        `http://localhost:8080/platform/login?token=${token}`
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