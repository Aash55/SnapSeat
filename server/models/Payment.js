const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  booking_id: { type: DataTypes.INTEGER, allowNull: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  event_id: { type: DataTypes.INTEGER, allowNull: true },
  hold_group_id: { type: DataTypes.UUID, allowNull: false },
  idempotency_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  status: {
    type: DataTypes.ENUM('PENDING', 'SUCCESS', 'FAILED', 'REFUND_PENDING'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  gateway_payment_id: { type: DataTypes.STRING(255), allowNull: true },
  // [{ seatId, seatNumber, category, price }] as priced when the payment started.
  seat_snapshot: { type: DataTypes.JSONB, allowNull: true },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  failure_reason: { type: DataTypes.STRING(255), allowNull: true },
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
});

module.exports = Payment;
