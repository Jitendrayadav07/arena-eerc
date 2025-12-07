const express = require("express");
const router = express.Router();

const subEntityController = require("../controllers/subEntityController");
const JoiMiddleWare = require("../middlewares/joi/joiMiddleware");
const subEntityValidation = require("../validations/subEntityValidation");

router.post("/",
    JoiMiddleWare(subEntityValidation.registerSubEntityValidation, "body"),
    subEntityController.registerSubEntity
);


module.exports = router;
