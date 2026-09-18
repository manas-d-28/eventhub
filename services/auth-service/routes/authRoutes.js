const express = require('express');
const { body, validationResult } = require('express-validator');

const { getMe, login, register } = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  return next();
};

const emailValidation = body('email')
  .isEmail()
  .withMessage('A valid email is required')
  .normalizeEmail();

router.post(
  '/register',
  [
    emailValidation,
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    validateRequest
  ],
  register
);

router.post(
  '/login',
  [
    emailValidation,
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest
  ],
  login
);

router.get('/me', verifyToken, getMe);

module.exports = router;
