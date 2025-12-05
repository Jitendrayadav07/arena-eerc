// models/Entity.js
module.exports = (sequelize, DataTypes) => {
    const Entity = sequelize.define('tbl_entities', {
        entity_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email_id : {
            type: DataTypes.STRING,
            unique: true
        },
        name: {
            type: DataTypes.STRING
        },
        api_key: {
            type: DataTypes.STRING
        },
    }, {
      freezeTableName: true,
      timestamps: true,
    });
  
    return Entity;
  };
  