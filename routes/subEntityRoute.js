const express = require("express");
const router = express.Router();

const subEntityController = require("../controllers/subEntityController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const subEntityValidation = require("../validations/subEntityValidation");

router.post("/",
    JoiMiddleWare(subEntityValidation.registerSubEntityValidation, "body"),
    subEntityController.registerSubEntity
);

router.get("/verify/:token", subEntityController.verifySubEntity);

router.post("/resend-verification", subEntityController.resendVerificationToken);

router.post("/deposit", subEntityController.depositToken);

router.post("/withdraw", subEntityController.withdrawToken);

router.post("/get-sub-entity-by-email", subEntityController.getSubEntityByEmail);

module.exports = router;
