const { Sequelize } = require('sequelize');
const { db, isTest } = require('./index');

const common = {
  dialect: 'postgres',
  logging: false,
  // Keep timestamps in UTC end to end; the client formats for the viewer's timezone.
  timezone: '+00:00',
  pool: { max: isTest ? 10 : 20, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

const sequelize = db.url
  ? new Sequelize(db.url, common)
  : new Sequelize(db.database, db.username, db.password, { ...common, host: db.host, port: db.port });

module.exports = sequelize;
