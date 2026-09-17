require('dotenv').config();

const cors = require('cors');
const express = require('express');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ service: 'auth-service', status: 'ok' });
});

app.listen(port, () => {
  console.log(`Auth service running on port ${port}`);
});
