const express = require("express");
const router = express.Router();

const roleController = require("../controllers/roleController");
const JoiMiddleWare = require('../middlewares/joi/joiMiddleware'); 
const roleSchema = require("../validations/roleValidation");
const userAuth = require("../middlewares/jsonwebtoken/joiAuthMiddleware");
/* Validator middle ware for Joi Passes the error ahead */
/* If Middleware succeeds it will go to the controller. */

/*
@apiBody { 
    {
        "name": string
    }
} 
 */

router.post("/", 
// userAuth,
// RbacMiddleware.RbacCreateUpdateMiddleware,
JoiMiddleWare(roleSchema.createRole, 'body'),
roleController.createRole);

router.get("/", roleController. getRoles);



/*
    @apiParams = {
        id: number
    }
*/
router.get("/:id", 
userAuth,
JoiMiddleWare(roleSchema.getRole, 'params'),
roleController. getRole);

router.put("/update",
userAuth,
roleController. updateRole);


/*
    @apiParams = {
        id: number
    }
*/

router.delete("/:id", 
userAuth,
JoiMiddleWare(roleSchema.deleteRole, 'params'),
roleController.deleteRole);


module.exports = router;