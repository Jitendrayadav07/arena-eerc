// utils/createSubEntityEmailData.js
require('dotenv').config();
function createSubEntityEmailData(sub_entity, token, walletAddress) {
    return {
        name: sub_entity.name,
        address: walletAddress,              // used in .ejs
        redirectUrl: `${process.env.REDIRECT_URL}/v1/sub-entities/verify/${token}`,
        subject: "Welcome to Cloakefy",
        templateName: "register-sub-entity"      // **THIS IS IMPORTANT**
    };
}



module.exports = { createSubEntityEmailData };
