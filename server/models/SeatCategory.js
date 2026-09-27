const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SeatCategory = sequelize.define('SeatCategory', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'seat_categories',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['event_id', 'name'],
    },
  ],
});

module.exports = SeatCategory;
