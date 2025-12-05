// models/Wallet.js
module.exports = (sequelize, DataTypes) => {
    const Wallet = sequelize.define('tbl_wallets', {
        wallet_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        entity_id: {
            type: DataTypes.INTEGER
        },
        onchain_address: {
            type: DataTypes.STRING
        },
        personal_wallet_address : {
            type: DataTypes.STRING
        },
        network: {
            type: DataTypes.STRING
        },
        eerc_user_id: {
            type: DataTypes.STRING
        },
        eerc_key_id: {
            type: DataTypes.STRING
        },
    }, {
      freezeTableName: true,
      timestamps: true,
    });
  
    return Wallet;
};
  