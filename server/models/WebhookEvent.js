const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WebhookEvent = sequelize.define('WebhookEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  gateway_event_id: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  payment_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'payments',
      key: 'id',
    },
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'webhook_events',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = WebhookEvent;
