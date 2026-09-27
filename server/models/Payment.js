const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id',
    },
  },
  hold_group_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  idempotency_key: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  gateway_payment_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['hold_group_id'],
    },
    {
      fields: ['booking_id'],
    },
  ],
});

module.exports = Payment;
