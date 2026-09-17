require('dotenv').config();

const cors = require('cors');
const express = require('express');

const app = express();
const port = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ service: 'payment-service', status: 'ok' });
});

app.listen(port, () => {
  console.log(`Payment service running on port ${port}`);
});
