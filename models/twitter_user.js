//models/TwitterUser.js
module.exports = (sequelize, DataTypes) => {
    const TwitterUser = sequelize.define("twitter_user", {
        id: {
            type: DataTypes.INTEGER(11),
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false
        },
        display_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        profile_image_url: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        access_token: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        access_token_secret: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        followers_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        following_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        tweets_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        last_sync: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        timestamps: true,
        underscored: true,
        tableName: 'twitter_user'
    });
      
    return TwitterUser;
}
