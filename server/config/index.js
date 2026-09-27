// Single source of runtime configuration. Everything that reads process.env goes through here,
// so a missing or unsafe setting fails loudly at boot instead of silently at request time.
require('dotenv').config({ quiet: true });

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

function required(name) {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required environment variable ${name}. Copy server/.env.example to server/.env and fill it in.`);
  }
  return v;
}

const jwtSecret = required('JWT_SECRET');
if (isProd && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

// DATABASE_URL (Neon / Render style) wins over the individual DB_* variables.
const databaseUrl = isTest ? process.env.TEST_DATABASE_URL || null : process.env.DATABASE_URL || null;
const dbName = process.env.DB_NAME || 'snapseat';

const db = {
  url: databaseUrl,
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: isTest ? process.env.TEST_DB_NAME || `${dbName}_test` : dbName,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  // Neon and most hosted Postgres require TLS. Local Postgres usually doesn't have it.
  ssl: process.env.DB_SSL === 'true' || (!!databaseUrl && process.env.DB_SSL !== 'false'),
};

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  env,
  isProd,
  isTest,
  port: Number(process.env.PORT || 5000),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  webhookSecret: required('WEBHOOK_SECRET'),
  corsOrigins,
  // Lets the checkout "simulate failure" switch reach the fake gateway. Never on in production
  // unless explicitly enabled for a demo deployment.
  allowTestPaymentHooks: !isProd || process.env.ALLOW_TEST_PAYMENT_HOOKS === 'true',
  runExpiryWorker: !isTest && process.env.DISABLE_EXPIRY_WORKER !== 'true',
  db,
};
