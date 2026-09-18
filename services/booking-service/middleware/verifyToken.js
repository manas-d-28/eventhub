const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authorization = req.get('Authorization');
  const [scheme, token] = authorization ? authorization.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'JWT_SECRET is not configured' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    if (!req.user.userId) {
      return res.status(401).json({ error: 'Token userId is required' });
    }
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;
