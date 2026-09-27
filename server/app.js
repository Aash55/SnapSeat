const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const organizerRoutes = require('./routes/organizer');
const eventRoutes = require('./routes/events');
const holdRoutes = require('./routes/holds');
const paymentRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhooks');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/organizer', organizerRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/holds', holdRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' });
});

app.use(errorHandler);

module.exports = app;
