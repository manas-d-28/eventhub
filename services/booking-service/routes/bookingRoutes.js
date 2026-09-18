const express = require('express');
const { body, param, validationResult } = require('express-validator');

const {
  cancelBooking,
  confirmBooking,
  getBooking,
  getUserBookings,
  reserveBooking
} = require('../controllers/bookingController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

const bookingId = param('id').isInt({ min: 1 }).withMessage('Booking id must be a positive integer');

router.post(
  '/reserve',
  [
    verifyToken,
    body('eventId').trim().notEmpty().withMessage('eventId is required'),
    body('seatNumbers')
      .isArray({ min: 1 })
      .withMessage('seatNumbers must be a non-empty array'),
    body('seatNumbers.*')
      .trim()
      .notEmpty()
      .withMessage('Each seat number must be a non-empty string'),
    validateRequest
  ],
  (req, res, next) => {
    const uniqueSeats = new Set(req.body.seatNumbers);
    if (uniqueSeats.size !== req.body.seatNumbers.length) {
      return res.status(400).json({ error: 'seatNumbers must not contain duplicates' });
    }
    return next();
  },
  reserveBooking
);

router.post('/:id/confirm', [bookingId, validateRequest], confirmBooking);
router.post('/:id/cancel', [bookingId, validateRequest], cancelBooking);
router.get('/user/:userId', [param('userId').trim().notEmpty(), validateRequest], getUserBookings);
router.get('/:id', [bookingId, validateRequest], getBooking);

module.exports = router;
