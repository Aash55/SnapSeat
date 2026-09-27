const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  organizer_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  category: {
    type: DataTypes.ENUM('Concert', 'Comedy', 'Sports', 'Theatre'),
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  venue: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'events',
  timestamps: true,
  underscored: true,
});

module.exports = Event;
