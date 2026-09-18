const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const jwt = require('jsonwebtoken');

const paymentClient = axios.create({
  baseURL: 'http://localhost:3004',
  validateStatus: () => true
});
const bookingClient = axios.create({
  baseURL: 'http://localhost:3003',
  validateStatus: () => true
});

const bookingServiceToken = jwt.sign(
  { userId: 'payment-test-user', email: 'paytest@test.com' },
  process.env.JWT_SECRET || 'missing-secret',
  { expiresIn: '1h' }
);
const bookingHeaders = { Authorization: `Bearer ${bookingServiceToken}` };
const bookingData = {
  eventId: 'payment-test-event',
  seatNumbers: ['P1']
};

let bookingId;
let paymentId;
let paymentStatus;
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

const run = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in .env');
  }

  const reservation = await bookingClient.post('/bookings/reserve', bookingData, {
    headers: bookingHeaders
  });
  assert(reservation.status === 201, `booking reservation expected 201, received ${reservation.status}`);
  bookingId = reservation.data.bookingId;
  assert(bookingId, 'booking service did not return a bookingId');
  console.log(`Created integration test booking: ${bookingId}`);

  await runTest('charges the booking with a definitive mock payment result', async () => {
    let lastError;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        const response = await paymentClient.post('/payments/charge', {
          bookingId,
          amount: 25.5,
          cardDetails: { number: 'mock-card', expiry: '12/30', cvv: '123' }
        });

        if (response.status === 200
          && typeof response.data.success === 'boolean'
          && ['success', 'failed'].includes(response.data.status)
          && response.data.paymentId) {
          paymentId = response.data.paymentId;
          paymentStatus = response.data.status;
          console.log(`Payment outcome: ${paymentStatus} (attempt ${attempt})`);
          return;
        }

        lastError = new Error(`received status ${response.status} or invalid payment response`);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`no definitive payment result after 5 attempts: ${lastError.message}`);
  });

  await runTest('retrieves the payment by paymentId', async () => {
    const response = await paymentClient.get(`/payments/${paymentId}`);

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.data.payment?.paymentId === paymentId, 'paymentId does not match');
    assert(response.data.payment?.status === paymentStatus, 'payment status does not match');
  });

  await runTest('retrieves payments by bookingId', async () => {
    const response = await paymentClient.get(`/payments/booking/${bookingId}`);

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(Array.isArray(response.data.payments), 'payments was not an array');
    assert(response.data.payments.some((payment) => payment.paymentId === paymentId), 'payment not found for booking');
  });

  await runTest('booking status matches the payment outcome', async () => {
    const response = await bookingClient.get(`/bookings/${bookingId}`);
    const expectedStatus = paymentStatus === 'success' ? 'confirmed' : 'cancelled';

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.data.booking?.status === expectedStatus,
      `expected booking status ${expectedStatus}, received ${response.data.booking?.status}`);
  });

  await runTest('returns 404 for a nonexistent payment', async () => {
    const response = await paymentClient.get('/payments/00000000-0000-0000-0000-000000000000');

    assert(response.status === 404, `expected 404, received ${response.status}`);
  });

  console.log(`\n${passed}/5 tests passed`);
  process.exitCode = passed === 5 ? 0 : 1;
};

run().catch((error) => {
  console.error(`FAIL: Test setup error - ${error.message}`);
  console.log(`\n${passed}/5 tests passed`);
  process.exitCode = 1;
});
