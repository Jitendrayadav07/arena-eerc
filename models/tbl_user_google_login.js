// models/Entity.js
module.exports = (sequelize, DataTypes) => {
    const GoogleLogin = sequelize.define('tbl_user_google_login', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        google_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING,
        },
        email: {
            type: DataTypes.STRING,
        },
        profile_pic: {
            type: DataTypes.STRING,
        },
    }, {
        freezeTableName: true,
        timestamps: true,
    });

    return GoogleLogin;
};
