// config/db.config.js
const { Sequelize } = require("sequelize");
require("dotenv").config();

//Localhost Databse Connection
const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      dialect: "mysql",
      port: 3306,
      dialectOptions: {
        connectTimeout: 20000 // Connection timeout in milliseconds (20 seconds)
      },
      pool: {
        max: 10, // Maximum number of connections in the pool
        min: 0, // Minimum number of connections in the pool
        acquire: 30000, // Maximum time in milliseconds that a connection can be acquired
        idle: 10000 // Maximum time in milliseconds that a connection can be idle before being released
      }
    }
);
  
  
  // Test the database connection
sequelize
    .authenticate()
    .then(() => {
      console.log("Database connection has been established successfully.");
    })
  .catch((err) => {
      console.error("Unable to connect to the database:", err);
});
  
  
const db = {};
  
db.Sequelize = Sequelize;
db.sequelize = sequelize;

 //All Model File Import 

db.tbl_arena_tokens = require("../models/tbl_arena_tokens")(sequelize, Sequelize);

module.exports = db;