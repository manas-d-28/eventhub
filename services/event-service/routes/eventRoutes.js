const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent
} = require('../controllers/eventController');
const requireAdmin = require('../middleware/requireAdmin');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  return next();
};

const eventFields = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('venue').trim().notEmpty().withMessage('Venue is required'),
  body('date').isISO8601().withMessage('Date must be a valid ISO 8601 date').toDate(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number').toFloat(),
  body('totalSeats').isInt({ min: 1 }).withMessage('Total seats must be at least 1').toInt(),
  body('availableSeats').isInt({ min: 0 }).withMessage('Available seats must be non-negative').toInt()
];

const updateEventFields = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('venue').optional().trim().notEmpty().withMessage('Venue cannot be empty'),
  body('date').optional().isISO8601().withMessage('Date must be a valid ISO 8601 date').toDate(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number').toFloat(),
  body('totalSeats').optional().isInt({ min: 1 }).withMessage('Total seats must be at least 1').toInt(),
  body('availableSeats').optional().isInt({ min: 0 }).withMessage('Available seats must be non-negative').toInt()
];

const eventIdValidation = param('id').isMongoId().withMessage('Invalid event id');
const dateFilterValidation = query('date').optional().isISO8601().withMessage('Date must be valid ISO 8601');

router.get('/', [dateFilterValidation, query('venue').optional().trim(), validateRequest], listEvents);
router.get('/:id', [eventIdValidation, validateRequest], getEvent);

router.post(
  '/',
  [verifyToken, requireAdmin, ...eventFields, validateRequest],
  createEvent
);

router.put(
  '/:id',
  [verifyToken, requireAdmin, eventIdValidation, ...updateEventFields, validateRequest],
  updateEvent
);

router.delete(
  '/:id',
  [verifyToken, requireAdmin, eventIdValidation, validateRequest],
  deleteEvent
);

module.exports = router;
