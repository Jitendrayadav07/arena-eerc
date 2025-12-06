// models/Wallet.js
module.exports = (sequelize, DataTypes) => {
    const Wallet = sequelize.define('tbl_wallets', {
        wallet_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          entity_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          address: {
            type: DataTypes.STRING,
            allowNull: true,
          },
          // identifier used when calling /v1/wallets/server
          server_wallet_identifier: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
          },
          send_address: {
            type: DataTypes.STRING,
            allowNull: false,
          },
          transfer_server_wallet_address: {
            type: DataTypes.STRING,
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
  
    return Wallet;
};
  