const express = require('express');
const { body, param, validationResult } = require('express-validator');

const {
  chargePayment,
  getBookingPayments,
  getPayment
} = require('../controllers/paymentController');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

router.post(
  '/charge',
  [
    body('bookingId').trim().notEmpty().withMessage('bookingId is required'),
    body('amount').isFloat({ min: 0 }).withMessage('amount must be a non-negative number').toFloat(),
    body('cardDetails').exists().withMessage('cardDetails is required'),
    validateRequest
  ],
  chargePayment
);

router.get('/booking/:bookingId', [param('bookingId').trim().notEmpty(), validateRequest], getBookingPayments);
router.get('/:paymentId', [param('paymentId').isUUID().withMessage('Invalid payment id'), validateRequest], getPayment);

module.exports = router;
