const express = require("express");
const router = express.Router();

const entityController = require("../controllers/entityController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const entitySchema = require("../validations/entityValidation");

router.post("/",
  JoiMiddleWare(entitySchema.registerEntityValidation, "body"),
  entityController.registerEntity
);
  

module.exports = router;
