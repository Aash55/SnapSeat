const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Hold = sequelize.define('Hold', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  seat_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'seats',
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  hold_group_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'holds',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['hold_group_id'],
    },
    {
      fields: ['expires_at'],
    },
    {
      fields: ['user_id'],
    },
  ],
});

module.exports = Hold;
