// models/tbl_distribution.js
module.exports = (sequelize, DataTypes) => {
    const Distribution = sequelize.define('tbl_distributions', {
        distribution_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        batch_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false
        },
        entity_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        total_amount: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: false
        },
        service_fee: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: false
        },
        payment_amount: {
            type: DataTypes.DECIMAL(20, 6),
            allowNull: false
        },
        service_address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        recipients: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: 'Array of {employee_address, amount} objects'
        },
        status: {
            type: DataTypes.ENUM('PENDING_PAYMENT', 'PAYMENT_VERIFIED', 'SETTLEMENT_CONFIRMED', 'PAYOUTS_COMPLETED', 'COMPLETED', 'FAILED'),
            defaultValue: 'PENDING_PAYMENT'
        },
        service_tx_hash: {
            type: DataTypes.STRING,
            allowNull: true
        },
        distribution_tx_hash: {
            type: DataTypes.STRING,
            allowNull: true
        },
        payment_authorization: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'X-PAYMENT authorization token'
        },
        network: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        freezeTableName: true,
        timestamps: true,
    });

    return Distribution;
};

