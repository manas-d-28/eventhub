const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const authEnvPath = path.join(__dirname, '..', 'services', 'auth-service', '.env');
if (!process.env.JWT_SECRET && fs.existsSync(authEnvPath)) {
  const authEnvironment = dotenv.parse(fs.readFileSync(authEnvPath));
  process.env.JWT_SECRET = authEnvironment.JWT_SECRET;
}

const axios = require('axios');
const jwt = require('jsonwebtoken');

const client = axios.create({
  baseURL: 'http://localhost:3000',
  validateStatus: () => true,
  timeout: 10000
});

const testUser = {
  name: 'Gateway Test User',
  email: `gateway-test-${Date.now()}@example.com`,
  password: 'GatewayTestPassword123!'
};
const adminToken = jwt.sign(
  { userId: 'gateway-test-user', email: 'gatewaytest@test.com', role: 'admin' },
  process.env.JWT_SECRET || 'missing-secret',
  { expiresIn: '1h' }
);
const authHeaders = { Authorization: `Bearer ${adminToken}` };
const eventPayload = {
  title: `Gateway Test Event ${Date.now()}`,
  description: 'Event created through the gateway test',
  venue: 'Gateway Test Venue',
  date: '2030-06-15T18:00:00.000Z',
  price: 25,
  totalSeats: 10,
  availableSeats: 10
};

let loginToken;
let eventId;
let bookingId;
let passed = 0;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const runTest = async (description, assertion) => {
  try {
    await assertion();
    passed += 1;
    console.log(`PASS: ${description}`);
  } catch (error) {
    console.error(`FAIL: ${description} - ${error.message}`);
  }
};

const run = async () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');

  await runTest('gateway health endpoint returns 200', async () => {
    const response = await client.get('/health');
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.data.status === 'ok', 'health status is not ok');
  });

  await runTest('proxies auth registration through /api/auth', async () => {
    const response = await client.post('/api/auth/register', testUser);
    assert(response.status === 201, `expected 201, received ${response.status}`);
    assert(response.data.user?.email === testUser.email, 'registered email does not match');
  });

  await runTest('proxies auth login through /api/auth', async () => {
    const response = await client.post('/api/auth/login', {
      email: testUser.email,
      password: testUser.password
    });
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(typeof response.data.token === 'string', 'login token was not returned');
    loginToken = response.data.token;
  });

  await runTest('proxies public event listing through /api/events', async () => {
    const response = await client.get('/api/events');
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(Array.isArray(response.data.events), 'events was not an array');
  });

  await runTest('proxies admin event creation through /api/events', async () => {
    const response = await client.post('/api/events', eventPayload, { headers: authHeaders });
    assert(response.status === 201, `expected 201, received ${response.status}`);
    eventId = response.data.event?._id || response.data.event?.id;
    assert(eventId, 'event id was not returned');
  });

  await runTest('proxies booking reservation through /api/bookings', async () => {
    const response = await client.post('/api/bookings/reserve', {
      eventId: String(eventId),
      seatNumbers: ['G1']
    }, { headers: authHeaders });
    assert(response.status === 201, `expected 201, received ${response.status}`);
    bookingId = response.data.bookingId;
    assert(bookingId, 'booking id was not returned');
  });

  await runTest('proxies payment charge through /api/payments', async () => {
    const response = await client.post('/api/payments/charge', {
      bookingId,
      amount: eventPayload.price,
      cardDetails: { number: 'mock-card', expiry: '12/30', cvv: '123' }
    });
    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(typeof response.data.paymentId === 'string', 'payment id was not returned');
  });

  await runTest('proxies notification health through /api/notifications', async () => {
    const response = await client.get('/api/notifications/health');
    assert(response.status === 200, `expected 200, received ${response.status}`);
  });

  await runTest('unrouted service path returns a clean error response', async () => {
    const response = await client.get('/api/nonexistent-service/foo');
    assert([404, 502].includes(response.status), `expected 404 or 502, received ${response.status}`);
    assert(!String(response.data).includes('Error:') && !String(response.data).includes('at '), 'raw stack trace returned');
  });

  await runTest('rate limiting triggers during 105 rapid health requests', async () => {
    const responses = await Promise.all(
      Array.from({ length: 105 }, () => client.get('/health'))
    );
    assert(responses.some((response) => response.status === 429), 'no request returned 429');
  });

  console.log(`\n${passed}/10 tests passed`);
  process.exitCode = passed === 10 ? 0 : 1;
};

run().catch((error) => {
  console.error(`FAIL: Test setup error - ${error.message}`);
  console.log(`\n${passed}/10 tests passed`);
  process.exitCode = 1;
});
