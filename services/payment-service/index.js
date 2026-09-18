require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();

const cors = require('cors');
const express = require('express');

const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const port = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());
app.use('/payments', paymentRoutes);

app.get('/', (_req, res) => {
  res.json({ service: 'payment-service', status: 'ok' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Payment service running on port ${port}`);
  });
}

module.exports = app;
