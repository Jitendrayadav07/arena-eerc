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
  
    return Wallet;
};
  