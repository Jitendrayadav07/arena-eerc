const Response = require("../classes/Response");
const db = require("../config/db.config");


const getAllEercArenaTokens = async (req, res) => {
    try {
        let response = await db.tbl_arena_tokens.findAll(
            {
                where: {
                    is_eerc: 1,
                    is_auditor : 1
                }
            }
        );
        return res.status(200).send(Response.sendResponse(true,response,null,200));
    }catch(err){
        return res.status(500).send(Response.sendResponse(false,null,SHILL_CATEGORY_CONSTANTS_STATUS.ERROR_OCCURED,500));
    }
}

module.exports = {
    getAllEercArenaTokens
}