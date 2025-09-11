const formData = require("express-form-data");
const express = require("express");
const os = require("os");
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const routes = require("./routes");
const path = require('path')
const dotenv = require('dotenv');
dotenv.config();

app.use(formData.parse());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());


// Sync models with the database
const sequelizeDB = require("./config/db.config");
sequelizeDB.sequelize.sync({force: true});

app.use("/v1", routes);

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});
