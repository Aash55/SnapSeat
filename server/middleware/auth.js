const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to continue', code: 'UNAUTHORIZED' });
  }
  try {
    const decoded = jwt.verify(header.slice(7), jwtSecret);
    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.', code: 'SESSION_EXPIRED' });
  }
};

module.exports = authMiddleware;
