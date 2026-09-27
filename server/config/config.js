// Used only by sequelize-cli (migrations / seeders). Reads the same settings as the app.
const { db } = require('./index');

const base = {
  dialect: 'postgres',
  logging: false,
  dialectOptions: db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

const conn = db.url
  ? { ...base, url: db.url }
  : { ...base, host: db.host, port: db.port, database: db.database, username: db.username, password: db.password };

module.exports = { development: conn, test: conn, production: conn };
