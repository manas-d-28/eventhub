const { randomUUID } = require('crypto');

const { updateBooking } = require('../config/bookingClient');
const { createPayment, findPaymentById, findPaymentsByBookingId } = require('../models/paymentStore');

const processPayment = () => new Promise((resolve) => {
  const delay = 1000 + Math.floor(Math.random() * 1000);
  setTimeout(() => resolve(Math.random() < 0.9), delay);
});

const chargePayment = async (req, res) => {
  const { bookingId, amount } = req.body;
  const paymentId = randomUUID();
  const successful = await processPayment();
  const status = successful ? 'success' : 'failed';

  await updateBooking(bookingId, successful ? 'confirm' : 'cancel');

  const payment = createPayment({
    paymentId,
    bookingId,
    amount,
    status,
    timestamp: new Date().toISOString()
  });

  return res.status(200).json({
    success: successful,
    paymentId: payment.paymentId,
    status: payment.status
  });
};

const getPayment = (req, res) => {
  const payment = findPaymentById(req.params.paymentId);
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }

  return res.json({ payment });
};

const getBookingPayments = (req, res) => res.json({
  payments: findPaymentsByBookingId(req.params.bookingId)
});

module.exports = { chargePayment, getBookingPayments, getPayment };
