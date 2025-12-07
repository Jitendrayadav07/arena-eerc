// models/Wallet.js
module.exports = (sequelize, DataTypes) => {
    const Sub_Entity_Wallet = sequelize.define('tbl_sub_entities_wallets', {
        wallet_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        sub_entity_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        encrypted_private_key: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        network: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "avalanche-fuji", // human-readable
        },
        chain_id: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "eip155:43113", // Avalanche Fuji CAIP-style is typical in thirdweb, or just "43113" if you prefer
        },
    }, {
        freezeTableName: true,
        timestamps: true,
    });

    return Sub_Entity_Wallet;
};
