require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const cors = require('cors');
const express = require('express');

const connectDatabase = require('./config/database');
const eventRoutes = require('./routes/eventRoutes');

const app = express();
const port = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());
app.use('/events', eventRoutes);

app.get('/', (_req, res) => {
  res.json({ service: 'event-service', status: 'ok' });
});

const startServer = async () => {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`Event service running on port ${port}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start event service:', error.message);
    process.exit(1);
  });
}

module.exports = app;
