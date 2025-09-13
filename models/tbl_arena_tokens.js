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
      status: {
        type: DataTypes.TEXT
      },
      creator_address: {
        type: DataTypes.TEXT
      },
      create_token_tx_id: {
        type: DataTypes.TEXT
      },
      pair_address: {
        type: DataTypes.TEXT
      },
      photo_url: {
        type: DataTypes.TEXT
      },
      is_eerc: {
        type: DataTypes.BOOLEAN
      },
    }, {
      freezeTableName: true,
      timestamps: false, // system_created is manually handled
      underscored: true
    });
  
    return ArenaTokenCoin;
  };
  