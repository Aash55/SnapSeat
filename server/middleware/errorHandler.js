const { isProd, isTest } = require('../config');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Malformed JSON body from express.json()
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON', code: 'BAD_JSON' });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: err.errors[0]?.message || 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Resource already exists', code: 'DUPLICATE' });
  }

  // Invalid input that slipped past validation (e.g. a bad enum value) is still the client's
  // fault: answer 400 and never echo the raw database message.
  if (err.name === 'SequelizeDatabaseError' && /^22|^23/.test(err.parent?.code || '')) {
    return res.status(400).json({ error: 'Invalid input', code: 'VALIDATION_ERROR' });
  }

  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code, ...(err.details || {}) });
  }

  if (!isTest) console.error('[error]', req.method, req.originalUrl, err);
  res.status(500).json({
    error: isProd ? 'Something went wrong. Please try again.' : err.message,
    code: 'INTERNAL_ERROR',
  });
};

module.exports = errorHandler;
