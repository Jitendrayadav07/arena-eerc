// utils/emailUtils.js
require('dotenv').config();
function createEntityEmailData(entity, token, walletAddress) {
    return {
        name: entity.name,
        address: walletAddress,              // used in .ejs
        redirectUrl: `${process.env.REDIRECT_URL}/v1/entities/verify/${token}`,
        subject: "Welcome to Cloakefy",
        templateName: "register-entity"      // **THIS IS IMPORTANT**
    };
}



module.exports = { createEntityEmailData };
