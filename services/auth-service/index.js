require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const cors = require('cors');
const express = require('express');

const connectDatabase = require('./config/database');
const authRoutes = require('./routes/authRoutes');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/', authRoutes);

app.get('/', (_req, res) => {
  res.json({ service: 'auth-service', status: 'ok' });
});

const startServer = async () => {
  await connectDatabase();

  app.listen(port, () => {
    console.log(`Auth service running on port ${port}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start auth service:', error.message);
    process.exit(1);
  });
}

module.exports = app;
