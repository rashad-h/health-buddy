'use strict';

const cors = require('cors');
const express = require('express');
const { PORT } = require('./config/constants');
const { createRateLimiter } = require('./middleware/rateLimit');
const logger = require('./utils/logger');
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payments');

const app = express();

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(createRateLimiter());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'health-buddy-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);

app.use((err, _req, res, _next) => {
  logger.error('unhandled_error', { message: err.message });
  res.status(500).json({ error: 'internal_error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info('server_started', { port: PORT });
  });
}

module.exports = app;
