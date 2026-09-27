const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Seat = sequelize.define('Seat', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  event_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'events',
      key: 'id',
    },
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'seat_categories',
      key: 'id',
    },
  },
  seat_number: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('free', 'held', 'booked'),
    allowNull: false,
    defaultValue: 'free',
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id',
    },
  },
}, {
  tableName: 'seats',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'seat_number'],
    },
    {
      fields: ['event_id', 'status'],
    },
  ],
});

module.exports = Seat;
