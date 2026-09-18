const payments = [];

const createPayment = (payment) => {
  payments.push(payment);
  return payment;
};

const findPaymentById = (paymentId) => payments.find((payment) => payment.paymentId === paymentId);
const findPaymentsByBookingId = (bookingId) => payments.filter((payment) => payment.bookingId === bookingId);

module.exports = { createPayment, findPaymentById, findPaymentsByBookingId };
