// models/Sub_Entity.js
module.exports = (sequelize, DataTypes) => {
    const Sub_Entity = sequelize.define('tbl_sub_entities', {
        sub_entity_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        email_id: {
            type: DataTypes.STRING,
            unique: true
        },
        name: {
            type: DataTypes.STRING
        },
        role: {
            type: DataTypes.STRING
        },
        api_key: {
            type: DataTypes.STRING
        },
        allocation_type: {
            type: DataTypes.STRING
        },
        allocation: {
            type: DataTypes.INTEGER
        },
    }, {
        freezeTableName: true,
        timestamps: true,
    });

    return Sub_Entity;
};
