const twitterClient = require("../twitterClient");
const Response = require("../classes/Response");
const db = require("../config/db.config");

const twitterPostController = async (req, res) => {
    try {
        const { message } = req.body;
        const response = await twitterClient.twitterClient.v2.tweet(message);
        return res.status(200).send(Response.sendResponse(true,response,null,200));
    } catch (error) {
        return res.status(500).send(Response.sendResponse(false,null,error.message,500));
    }
}

module.exports = {
    twitterPostController
}