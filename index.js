const formData = require("express-form-data");
const express = require("express");
const os = require("os");
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const app = express();
const path = require('path')
const dotenv = require('dotenv');
const cron = require('./cron');
// const tokenTweetTwitter = require('./tokenTweetTwitter');
dotenv.config();
const routes = require("./routes");

app.use(formData.parse());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: true,
    credentials: true
}));

// Serve static files
app.use(express.static('public'));

// Sync models with the database
const sequelizeDB = require("./config/db.config");
sequelizeDB.sequelize.sync(sequelizeDB);

app.use("/v1", routes);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Cron job started - will run every minute');
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
