// models/Entity.js
module.exports = (sequelize, DataTypes) => {
    const Transaction = sequelize.define('tbl_transactions', {
        tx_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        entity_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        from_address: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        to_address: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        amount: {
          type: DataTypes.STRING, // store human-readable (e.g. "0.01")
          allowNull: false,
        },
        chain_id: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        thirdweb_tx_id: {
          type: DataTypes.STRING, // ID returned by /v1/transactions
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "QUEUED", // or SUBMITTED, CONFIRMED, FAILED
        },
        raw_response: {
          type: DataTypes.TEXT("long"),
          allowNull: true,
        },
    }, {
      freezeTableName: true,
      timestamps: true,
    });
  
    return Transaction;
  };
  