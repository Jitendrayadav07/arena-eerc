const express = require("express");
const router = express.Router();

const entityController = require("../controllers/entityController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const entitySchema = require("../validations/entityValidation");

router.post("/",
  JoiMiddleWare(entitySchema.registerEntityValidation, "body"),
  entityController.registerEntity
);

router.get("/verify/:token", entityController.verifyEntity);

router.post("/resend-verification", entityController.resendVerificationToken);

module.exports = router;
