const formData = require("express-form-data");
const express = require("express");
const os = require("os");
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const app = express();
const routes = require("./routes");
const path = require('path')
const dotenv = require('dotenv');
dotenv.config();

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

// All routes
app.use("/v1", routes);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
