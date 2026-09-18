require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const cors = require('cors');
const express = require('express');

const { closeConnections, initialize } = require('./config/connections');
const bookingRoutes = require('./routes/bookingRoutes');
const { startExpiryJob, stopExpiryJob } = require('./controllers/bookingController');

const app = express();
const port = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use('/bookings', bookingRoutes);

app.get('/', (_req, res) => {
  res.json({ service: 'booking-service', status: 'ok' });
});

const startServer = async () => {
  await initialize();

  const server = app.listen(port, () => {
    console.log(`Booking service running on port ${port}`);
  });
  startExpiryJob();

  const shutdown = async () => {
    stopExpiryJob();
    server.close(async () => {
      await closeConnections();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start booking service:', error.message);
    process.exit(1);
  });
}

module.exports = app;
