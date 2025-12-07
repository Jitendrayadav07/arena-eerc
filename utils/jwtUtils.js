// utils/emailUtils.js
require('dotenv').config();
function createWelcomeEmailData(user, token) {
    return {
        token,
        firstName: user.first_name,
        lastName: user.last_name,
        filePath: "user-register",
        subject: "Welcome to Cloakefy",
        contact_person: user.contact_person,
        redirectUrl: `${process.env.REDIRECT_URL}/${token}`,
    };
}

module.exports = { createWelcomeEmailData };
