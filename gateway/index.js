require('dotenv').config();

const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const port = process.env.PORT || 3000;

const requiredTargets = {
  '/api/auth': 'AUTH_SERVICE_URL',
  '/api/events': 'EVENT_SERVICE_URL',
  '/api/bookings': 'BOOKING_SERVICE_URL',
  '/api/payments': 'PAYMENT_SERVICE_URL',
  '/api/notifications': 'NOTIFICATION_SERVICE_URL'
};

const missingTargets = Object.values(requiredTargets).filter((name) => !process.env[name]);
if (missingTargets.length > 0) {
  throw new Error(`Missing gateway environment variables: ${missingTargets.join(', ')}`);
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN }));
app.use((req, _res, next) => {
  console.log(`[Gateway] ${req.method} ${req.path}`);
  next();
});
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later' });
  }
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', gateway: 'running' });
});

const proxyError = (error, _req, res) => {
  console.error('[Gateway] Proxy request failed:', error.message);
  if (!res.headersSent) {
    res.status(502).json({ error: 'Bad gateway: target service unavailable' });
  }
};

const proxyConfigs = {
  '/api/auth': { environmentName: 'AUTH_SERVICE_URL', rewrite: '^/api/auth' },
  '/api/events': { environmentName: 'EVENT_SERVICE_URL', rewrite: '^/api' },
  '/api/bookings': { environmentName: 'BOOKING_SERVICE_URL', rewrite: '^/api' },
  '/api/payments': { environmentName: 'PAYMENT_SERVICE_URL', rewrite: '^/api' },
  '/api/notifications': { environmentName: 'NOTIFICATION_SERVICE_URL', rewrite: '^/api/notifications' }
};

Object.entries(proxyConfigs).forEach(([prefix, config]) => {
  app.use(createProxyMiddleware({
    pathFilter: prefix,
    target: process.env[config.environmentName],
    changeOrigin: true,
    pathRewrite: { [config.rewrite]: '' },
    on: { error: proxyError }
  }));
});

app.use((error, _req, res, _next) => {
  console.error('[Gateway] Unhandled error:', error);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal gateway error' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Gateway running on port ${port}`);
  });
}

module.exports = app;
