const { redis } = require('./connections');

const LOCK_TTL_MS = 5 * 60 * 1000;
const RELEASE_LOCK_SCRIPT = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`;
const CONFIRM_LOCKS_SCRIPT = `
  for index = 1, #KEYS do
    if redis.call('get', KEYS[index]) ~= ARGV[1] then
      return 0
    end
  end
  for index = 1, #KEYS do
    redis.call('set', KEYS[index], ARGV[2])
    redis.call('persist', KEYS[index])
  end
  return 1
`;

const lockKey = (eventId, seatNumber) => `lock:event:${eventId}:seat:${seatNumber}`;

const acquireLock = (eventId, seatNumber, userId) => (
  redis.set(lockKey(eventId, seatNumber), userId, 'NX', 'PX', LOCK_TTL_MS)
);

const releaseLock = (eventId, seatNumber, userId) => (
  redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey(eventId, seatNumber), userId)
);

const getLockValue = (eventId, seatNumber) => (
  redis.get(lockKey(eventId, seatNumber))
);

const confirmLocks = (eventId, seatNumbers, userId, bookingId) => {
  const keys = seatNumbers.map((seatNumber) => lockKey(eventId, seatNumber));
  return redis.eval(
    CONFIRM_LOCKS_SCRIPT,
    keys.length,
    ...keys,
    userId,
    `CONFIRMED:${bookingId}`
  );
};

const releaseLocks = async (eventId, seatNumbers, userId) => {
  await Promise.all(seatNumbers.map((seatNumber) => releaseLock(eventId, seatNumber, userId)));
};

module.exports = {
  LOCK_TTL_MS,
  acquireLock,
  confirmLocks,
  getLockValue,
  lockKey,
  releaseLock,
  releaseLocks
};
