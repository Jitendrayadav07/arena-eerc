// models/ArenaTokenCoin.js
module.exports = (sequelize, DataTypes) => {
    const ArenaTokenCoin = sequelize.define('tbl_arena_tokens', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      contract_address: {
        type: DataTypes.TEXT
      },
      name: {
        type: DataTypes.TEXT
      },
      symbol: {
        type: DataTypes.TEXT
      },
      creator_address: {
        type: DataTypes.TEXT
      },
      pair_address: {
        type: DataTypes.TEXT
      },
      registrationVerifier: {
        type: DataTypes.TEXT
      },
      mintVerifier: {
        type: DataTypes.TEXT
      },
      withdrawVerifier: {
        type: DataTypes.TEXT
      },
      transferVerifier: {
        type: DataTypes.TEXT
      },
      burnVerifier: {
        type: DataTypes.TEXT
      },
      babyJubJub: {
        type: DataTypes.TEXT
      },
      registrar: {
        type: DataTypes.TEXT
      },
      encryptedERC: {
        type: DataTypes.TEXT
      },
      photo_url: {
        type: DataTypes.TEXT
      },
      is_eerc: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0
      },
    }, {
      freezeTableName: true,
      timestamps: true, // system_created is manually handled
      underscored: true
    });
  
    return ArenaTokenCoin;
  };
  