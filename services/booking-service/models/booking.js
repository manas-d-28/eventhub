const toBooking = (row) => ({
  id: row.id,
  userId: row.user_id,
  eventId: row.event_id,
  seatNumbers: row.seat_numbers,
  status: row.status,
  createdAt: row.created_at
});

module.exports = { toBooking };
