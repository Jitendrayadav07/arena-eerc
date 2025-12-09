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

      let role = "entity"; 
      let api_key = null;
  
      const entity = await db.tbl_entities.findOne({
        where: { email_id: user_data.email }
      });
      
      if (entity) {
        role = "entity";
        api_key = entity.api_key;
      } else {
        const subEntity = await db.tbl_sub_entity.findOne({
          where: { email_id: user_data.email }
        });
        
        if (subEntity) {
          role = "subentity";
          // For subentity, always use the parent entity's api_key
          const parentEntity = await db.tbl_entities.findOne({
            where: { entity_id: subEntity.entity_id }
          });
          if (parentEntity) {
            api_key = parentEntity.api_key;
          }
        }
      }
      
      const tokenPayload = {
        id: user_data.id,
        email: user_data.email,
        google_id: user_data.google_id,
        role: role,
      };
      
      // Add api_key to payload if it exists
      if (api_key) {
        tokenPayload.api_key = api_key;
      }
      
      const token = jwt.sign(
        tokenPayload,
        JWT_EERCx402_SECRET,
        { expiresIn: "24h" }
      );

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