const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

const register = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name });

    return res.status(201).json({
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    return res.status(500).json({ error: 'Unable to register user' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');
    const passwordMatches = user && await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({ token: createToken(user) });
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Unable to log in' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('_id email name');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: { id: user._id, email: user.email, name: user.name }
    });
  } catch (_error) {
    return res.status(500).json({ error: 'Unable to fetch user' });
  }
};

module.exports = { getMe, login, register };
