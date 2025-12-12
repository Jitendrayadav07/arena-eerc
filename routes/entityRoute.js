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

router.post("/deposit", entityController.depositToken);

router.post("/withdraw", entityController.withdrawToken);

router.post("/get-entity", entityController.getAllEntities);

router.post("/transfer",
  JoiMiddleWare(entitySchema.transferTokenValidation, "body"),
  entityController.transferToken
);

router.get("/:entity_id", entityController.getEntityById);

module.exports = router;
