const axios = require('axios');

const bookingClient = axios.create({
  baseURL: process.env.BOOKING_SERVICE_URL,
  timeout: 10000,
  validateStatus: () => true
});

const updateBooking = async (bookingId, action) => {
  try {
    const response = await bookingClient.post(`/bookings/${bookingId}/${action}`);
    if (response.status < 200 || response.status >= 300) {
      console.error(`Booking-service ${action} returned status ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error(`Booking-service ${action} request failed:`, error.message);
    return null;
  }
};

module.exports = { updateBooking };
