const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { corsOrigins } = require('./config');

const authRoutes = require('./routes/auth');
const organizerRoutes = require('./routes/organizer');
const eventRoutes = require('./routes/events');
const holdRoutes = require('./routes/holds');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./models');

const app = express();

app.set('trust proxy', 1); // behind Render/Vercel proxies: req.ip is the real client
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    // No Origin header = same-origin, curl or server-to-server (the gateway webhook).
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Simulate-Payment'],
}));

// The webhook must see the exact bytes the gateway signed, so it gets the raw body parser
// and is mounted BEFORE express.json().
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '64kb' }), webhookRoutes);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down', timestamp: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/holds', holdRoutes);
app.use('/api/payments', paymentRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

app.use(errorHandler);


module.exports = app;
