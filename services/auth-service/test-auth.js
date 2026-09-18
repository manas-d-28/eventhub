const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3001',
  validateStatus: () => true
});

const testUser = {
  name: 'Auth Test User',
  email: `auth-test-${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

let token;
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

const run = async () => {
  await runTest('registers a user without returning the password', async () => {
    const response = await client.post('/register', testUser);

    assert(response.status === 201, `expected 201, received ${response.status}`);
    assert(response.data.user, 'user was not returned');
    assert(response.data.user.email === testUser.email, 'email does not match');
    assert(response.data.user.name === testUser.name, 'name does not match');
    assert(!Object.prototype.hasOwnProperty.call(response.data, 'password'), 'password returned in response');
    assert(!Object.prototype.hasOwnProperty.call(response.data.user, 'password'), 'password returned in user response');
  });

  await runTest('rejects duplicate email registration', async () => {
    const response = await client.post('/register', testUser);

    assert(response.status === 409, `expected 409, received ${response.status}`);
  });

  await runTest('logs in with correct credentials and returns a JWT', async () => {
    const response = await client.post('/login', {
      email: testUser.email,
      password: testUser.password
    });

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(typeof response.data.token === 'string' && response.data.token.length > 0, 'JWT token was not returned');
    token = response.data.token;
  });

  await runTest('rejects login with a wrong password', async () => {
    const response = await client.post('/login', {
      email: testUser.email,
      password: 'WrongPassword123!'
    });

    assert(response.status === 401, `expected 401, received ${response.status}`);
  });

  await runTest('returns the registered user for a valid token', async () => {
    const response = await client.get('/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert(response.status === 200, `expected 200, received ${response.status}`);
    assert(response.data.user, 'user was not returned');
    assert(response.data.user.email === testUser.email, 'email does not match');
    assert(response.data.user.name === testUser.name, 'name does not match');
  });

  await runTest('rejects a request without an Authorization header', async () => {
    const response = await client.get('/me');

    assert(response.status === 401, `expected 401, received ${response.status}`);
  });

  await runTest('rejects an invalid token', async () => {
    const response = await client.get('/me', {
      headers: { Authorization: 'Bearer invalid-token' }
    });

    assert(response.status === 401, `expected 401, received ${response.status}`);
  });

  console.log(`\n${passed}/7 tests passed`);
  process.exitCode = passed === 7 ? 0 : 1;
};

run().catch((error) => {
  console.error(`FAIL: Test runner error - ${error.message}`);
  console.log(`\n${passed}/7 tests passed`);
  process.exitCode = 1;
});
