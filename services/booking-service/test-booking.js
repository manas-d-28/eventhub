const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');

const client = axios.create({
  baseURL: 'http://localhost:3003',
  validateStatus: () => true
});

const eventId = 'test-event-001';
const userAToken = jwt.sign(
  { userId: 'user-a', email: 'a@test.com' },
  process.env.JWT_SECRET || 'missing-secret',
  { expiresIn: '1h' }
);
const userBToken = jwt.sign(
  { userId: 'user-b', email: 'b@test.com' },
  process.env.JWT_SECRET || 'missing-secret',
  { expiresIn: '1h' }
);

const userHeaders = (token) => ({ Authorization: `Bearer ${token}` });
const testEvent = (seatNumbers) => ({ eventId, seatNumbers });

const clearTestEventLocks = async () => {
  const redis = new Redis(process.env.REDIS_URL);
  let cursor = '0';
  const keys = [];

  do {
    const [nextCursor, matchingKeys] = await redis.scan(
      cursor,
      'MATCH',
      `lock:event:${eventId}:*`,
      'COUNT',
      100
    );
    cursor = nextCursor;
    keys.push(...matchingKeys);
  } while (cursor !== '0');

  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();
};

let bookingA;
let bookingB;
let concurrencyBooking;
let passed = 0;

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
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

const bookingIdFrom = (response) => response.data.bookingId || response.data.booking?.id;

const run = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in .env');
  }

  await clearTestEventLocks();

  await runTest('User A reserves seats A1 and A2', async () => {
    const response = await client.post('/bookings/reserve', testEvent(['A1', 'A2']), {
      headers: userHeaders(userAToken)
    });

    assert(response.status === 201, `expected 201, received ${response.status}`);
    bookingA = bookingIdFrom(response);
    assert(bookingA, 'bookingId was not returned');
  });

  await runTest('only one user wins the simultaneous A3 reservation race', async () => {
    const [userAResponse, userBResponse] = await Promise.all([
      client.post('/bookings/reserve', testEvent(['A3']), { headers: userHeaders(userAToken) }),
      client.post('/bookings/reserve', testEvent(['A3']), { headers: userHeaders(userBToken) })
    ]);
    const responses = [userAResponse, userBResponse];
    const successful = responses.filter((response) => response.status === 201);
    const conflicts = responses.filter((response) => response.status === 409);

    assert(successful.length === 1 && conflicts.length === 1,
      `expected exactly one 201 and one 409, received ${responses.map((response) => response.status).join(' and ')}`);
    concurrencyBooking = bookingIdFrom(successful[0]);
    assert(concurrencyBooking, 'winning concurrency bookingId was not returned');
  });

  await runTest('User B cannot reserve User A\'s locked A1 seat', async () => {
    const response = await client.post('/bookings/reserve', testEvent(['A1']), {
      headers: userHeaders(userBToken)
    });

    assert(response.status === 409, `expected 409, received ${response.status}`);
  });

  await runTest('bookingA details are pending', async () => {
    const response = await client.get(`/bookings/${bookingA}`);

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.data.booking?.status === 'pending', 'bookingA is not pending');
  });

  await runTest('bookingA confirms and remains confirmed', async () => {
    const confirmResponse = await client.post(`/bookings/${bookingA}/confirm`);
    assert(confirmResponse.status === 200, `expected 200, received ${confirmResponse.status}`);

    const detailsResponse = await client.get(`/bookings/${bookingA}`);
    assert(detailsResponse.status === 200, `expected 200 after confirm, received ${detailsResponse.status}`);
    assert(detailsResponse.data.booking?.status === 'confirmed', 'bookingA is not confirmed');
  });

  await runTest('confirmed bookingA keeps A1 unavailable', async () => {
    const response = await client.post('/bookings/reserve', testEvent(['A1']), {
      headers: userHeaders(userBToken)
    });

    assert(response.status === 409, `expected 409, received ${response.status}`);
  });

  await runTest('User A reserves B1 as bookingB', async () => {
    const response = await client.post('/bookings/reserve', testEvent(['B1']), {
      headers: userHeaders(userAToken)
    });

    assert(response.status === 201, `expected 201, received ${response.status}`);
    bookingB = bookingIdFrom(response);
    assert(bookingB, 'bookingB id was not returned');
  });

  await runTest('bookingB cancels and reports cancelled status', async () => {
    const cancelResponse = await client.post(`/bookings/${bookingB}/cancel`);
    assert(cancelResponse.status === 200, `expected 200, received ${cancelResponse.status}`);
    assert(cancelResponse.data.booking?.status === 'cancelled', 'bookingB is not cancelled');
  });

  await runTest('User B can reserve B1 after bookingB cancellation', async () => {
    const response = await client.post('/bookings/reserve', testEvent(['B1']), {
      headers: userHeaders(userBToken)
    });

    assert(response.status === 201, `expected 201, received ${response.status}`);
  });

  await runTest('User A history includes bookingA', async () => {
    const response = await client.get('/bookings/user/user-a');

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(Array.isArray(response.data.bookings), 'booking history is not an array');
    assert(response.data.bookings.some((booking) => String(booking.id) === String(bookingA)), 'bookingA not found in history');
  });

  console.log(`\n${passed}/10 tests passed`);
  process.exitCode = passed === 10 ? 0 : 1;
};

run().catch((error) => {
  console.error(`FAIL: Test runner error - ${error.message}`);
  console.log(`\n${passed}/10 tests passed`);
  process.exitCode = 1;
});
