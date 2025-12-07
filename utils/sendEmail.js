require("dotenv").config();
const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");

// Read email service and auth credentials from environment variables
const emailUsername = process.env.EMAIL_USERNAME;
const emailPassword = process.env.EMAIL_PASSWORD;

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: false,
    auth: {
        user: emailUsername,
        pass: emailPassword,
    },
});

// Function to send an email
const sendEmail = async (to, subject, templateName, emailData) => {
    const templatePath = path.join(
        __dirname,
        "../templates/",
        `${templateName}.ejs`
    );
    const emailTemplate = await ejs.renderFile(templatePath, emailData);

    const mailOptions = {
        from: emailUsername,
        to,
        subject,
        html: emailTemplate,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error("Error sending email:", error);
            // Handle error while sending email
        } else {
            // console.log("Email sent:", info.response);
            // Handle success after sending email
        }
    });
};

module.exports = sendEmail;
