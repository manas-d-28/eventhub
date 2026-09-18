require('dotenv').config();

const axios = require('axios');
const jwt = require('jsonwebtoken');

const client = axios.create({
  baseURL: 'http://localhost:3002',
  validateStatus: () => true
});

if (!process.env.JWT_SECRET) {
  console.error('FAIL: Test setup - JWT_SECRET is not configured');
  process.exitCode = 1;
} else {
  const adminToken = jwt.sign(
    { userId: 'test-admin-id', email: 'admin@test.com', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const userToken = jwt.sign(
    { userId: 'test-user-id', email: 'user@test.com', role: 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const testEvent = {
    title: `Auth-protected event ${Date.now()}`,
    description: 'End-to-end event-service test event',
    venue: 'Test Venue',
    date: '2030-06-15T18:00:00.000Z',
    price: 49.99,
    totalSeats: 100,
    availableSeats: 100
  };
  const updatedPrice = 59.99;
  let eventId;
  let passed = 0;

  const runTest = async (description, assertion) => {
    try {
      await assertion();
      passed += 1;
      console.log(`PASS: ${description}`);
    } catch (error) {
      console.error(`FAIL: ${description} - ${error.message}`);
    }
  };

  const assert = (condition, message) => {
    if (!condition) {
      throw new Error(message);
    }
  };

  const authHeaders = (token) => ({
    Authorization: `Bearer ${token}`
  });

  const run = async () => {
    await runTest('admin can create an event', async () => {
      const response = await client.post('/events', testEvent, {
        headers: authHeaders(adminToken)
      });

      assert(response.status === 201, `expected 201, received ${response.status}`);
      assert(response.data.event, 'event was not returned');
      assert(response.data.event.title === testEvent.title, 'title does not match');
      assert(response.data.event.totalSeats === testEvent.totalSeats, 'total seats do not match');
      eventId = response.data.event._id || response.data.event.id;
      assert(eventId, 'event id was not returned');
    });

    await runTest('regular user cannot create an event', async () => {
      const response = await client.post('/events', testEvent, {
        headers: authHeaders(userToken)
      });

      assert(response.status === 403, `expected 403, received ${response.status}`);
    });

    await runTest('creating an event without a token is rejected', async () => {
      const response = await client.post('/events', testEvent);

      assert(response.status === 401, `expected 401, received ${response.status}`);
    });

    await runTest('public event list includes the created event', async () => {
      const response = await client.get('/events');

      assert(response.status === 200, `expected 200, received ${response.status}`);
      assert(Array.isArray(response.data.events), 'events list was not returned');
      assert(response.data.events.some((event) => String(event._id || event.id) === String(eventId)), 'created event not found');
    });

    await runTest('event details return the current available seats', async () => {
      const response = await client.get(`/events/${eventId}`);
      const event = response.data.event;

      assert(response.status === 200, `expected 200, received ${response.status}`);
      assert(event, 'event was not returned');
      assert(event.title === testEvent.title, 'title does not match');
      assert(event.availableSeats === event.totalSeats, 'available seats do not equal total seats');
    });

    await runTest('admin can update the event price', async () => {
      const response = await client.put(`/events/${eventId}`, { price: updatedPrice }, {
        headers: authHeaders(adminToken)
      });

      assert(response.status === 200, `expected 200, received ${response.status}`);
      assert(response.data.event.price === updatedPrice, 'updated price does not match');
    });

    await runTest('regular user cannot update an event', async () => {
      const response = await client.put(`/events/${eventId}`, { price: 69.99 }, {
        headers: authHeaders(userToken)
      });

      assert(response.status === 403, `expected 403, received ${response.status}`);
    });

    await runTest('regular user cannot delete an event', async () => {
      const response = await client.delete(`/events/${eventId}`, {
        headers: authHeaders(userToken)
      });

      assert(response.status === 403, `expected 403, received ${response.status}`);
    });

    await runTest('admin can delete an event', async () => {
      const response = await client.delete(`/events/${eventId}`, {
        headers: authHeaders(adminToken)
      });

      assert([200, 204].includes(response.status), `expected 200 or 204, received ${response.status}`);
    });

    await runTest('deleted event returns 404', async () => {
      const response = await client.get(`/events/${eventId}`);

      assert(response.status === 404, `expected 404, received ${response.status}`);
    });

    console.log(`\n${passed}/10 tests passed`);
    process.exitCode = passed === 10 ? 0 : 1;
  };

  run().catch((error) => {
    console.error(`FAIL: Test runner error - ${error.message}`);
    console.log(`\n${passed}/10 tests passed`);
    process.exitCode = 1;
  });
}
