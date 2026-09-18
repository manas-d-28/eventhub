const { pool, producer } = require('../config/connections');
const {
  LOCK_TTL_MS,
  acquireLock,
  confirmLocks,
  getLockValue,
  releaseLocks
} = require('../config/redisLocks');
const { toBooking } = require('../models/booking');

const publishBookingEvent = async (booking, status) => {
  await producer.send({
    topic: 'booking-events',
    messages: [{
      key: String(booking.id),
      value: JSON.stringify({
        bookingId: booking.id,
        userId: booking.userId,
        eventId: booking.eventId,
        seatNumbers: booking.seatNumbers,
        status
      })
    }]
  });
};

const reserveBooking = async (req, res) => {
  const { eventId, seatNumbers } = req.body;
  const userId = req.user.userId;
  const acquiredSeats = [];

  try {
    // Pending locks are acquired one at a time. If any seat is already locked,
    // every lock acquired by this request is released before responding, so a
    // reservation is all-or-nothing and two users cannot claim the same seat.
    for (const seatNumber of seatNumbers) {
      const result = await acquireLock(eventId, seatNumber, userId);
      if (result !== 'OK') {
        await releaseLocks(eventId, acquiredSeats, userId);
        const existingValue = await getLockValue(eventId, seatNumber);
        const error = existingValue?.startsWith('CONFIRMED:')
          ? 'Seat already booked'
          : `Seat ${seatNumber} is temporarily held`;
        return res.status(409).json({ error });
      }
      acquiredSeats.push(seatNumber);
    }

    const result = await pool.query(
      `INSERT INTO bookings (user_id, event_id, seat_numbers, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING id, user_id, event_id, seat_numbers, status, created_at`,
      [userId, eventId, seatNumbers]
    );

    return res.status(201).json({
      bookingId: result.rows[0].id,
      lockExpiresAt: new Date(Date.now() + LOCK_TTL_MS).toISOString()
    });
  } catch (error) {
    await releaseLocks(eventId, acquiredSeats, userId).catch((releaseError) => {
      console.error('Unable to release reservation locks:', releaseError);
    });
    console.error('Unable to reserve booking:', error);
    return res.status(500).json({ error: 'Unable to reserve seats' });
  }
};

const getBooking = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, event_id, seat_numbers, status, created_at FROM bookings WHERE id = $1',
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json({ booking: toBooking(result.rows[0]) });
  } catch (error) {
    console.error('Unable to fetch booking:', error);
    return res.status(500).json({ error: 'Unable to fetch booking' });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, event_id, seat_numbers, status, created_at
       FROM bookings WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.params.userId]
    );
    return res.json({ bookings: result.rows.map(toBooking) });
  } catch (error) {
    console.error('Unable to fetch booking history:', error);
    return res.status(500).json({ error: 'Unable to fetch booking history' });
  }
};

const updateBookingStatus = async (req, res, status) => {
  const client = await pool.connect();
  let booking;

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, user_id, event_id, seat_numbers, status, created_at
       FROM bookings WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    booking = toBooking(result.rows[0]);
    if (booking.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Booking is already ${booking.status}` });
    }

    const updated = await client.query(
      `UPDATE bookings SET status = $1
       WHERE id = $2
       RETURNING id, user_id, event_id, seat_numbers, status, created_at`,
      [status, req.params.id]
    );
    await client.query('COMMIT');
    booking = toBooking(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Unable to ${status} booking:`, error);
    return res.status(500).json({ error: `Unable to ${status} booking` });
  } finally {
    client.release();
  }

  try {
    if (status === 'confirmed') {
      // Confirmation converts each temporary TTL-based hold into a permanent
      // lock owned by the booking. Only explicit cancellation may remove it.
      const converted = await confirmLocks(
        booking.eventId,
        booking.seatNumbers,
        booking.userId,
        booking.id
      );
      if (converted !== 1) {
        throw new Error('Unable to convert all seat locks to confirmed locks');
      }
    } else {
      // Cancellation intentionally deletes the temporary locks, making seats
      // available again. Confirmed locks are never released by this branch.
      await releaseLocks(booking.eventId, booking.seatNumbers, booking.userId);
    }
    await publishBookingEvent(booking, status);
    return res.status(200).json({ booking });
  } catch (error) {
    console.error(`Booking ${status} succeeded but follow-up processing failed:`, error);
    return res.status(500).json({ error: `Booking ${status}, but follow-up processing failed` });
  }
};

const confirmBooking = (req, res) => updateBookingStatus(req, res, 'confirmed');
const cancelBooking = (req, res) => updateBookingStatus(req, res, 'cancelled');

const expirePendingBookings = async () => {
  const result = await pool.query(
    `SELECT id, user_id, event_id, seat_numbers, status, created_at
     FROM bookings
     WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 minutes'`
  );

  for (const row of result.rows) {
    const booking = toBooking(row);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const update = await client.query(
        `UPDATE bookings SET status = 'cancelled'
         WHERE id = $1 AND status = 'pending'
         RETURNING id, user_id, event_id, seat_numbers, status, created_at`,
        [booking.id]
      );
      await client.query('COMMIT');
      if (update.rowCount === 0) continue;

      const cancelledBooking = toBooking(update.rows[0]);
      await releaseLocks(cancelledBooking.eventId, cancelledBooking.seatNumbers, cancelledBooking.userId);
      await publishBookingEvent(cancelledBooking, 'cancelled');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`Unable to expire booking ${booking.id}:`, error);
    } finally {
      client.release();
    }
  }
};

let expiryTimer;
const startExpiryJob = () => {
  expiryTimer = setInterval(() => {
    expirePendingBookings().catch((error) => console.error('Booking expiry job failed:', error));
  }, 60 * 1000);
};

const stopExpiryJob = () => {
  if (expiryTimer) clearInterval(expiryTimer);
};

module.exports = {
  cancelBooking,
  confirmBooking,
  expirePendingBookings,
  getBooking,
  getUserBookings,
  reserveBooking,
  startExpiryJob,
  stopExpiryJob
};
