const DEFAULT_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

class AppError extends Error {
  /**
   * @param {string} message  human-readable, safe to show to the user
   * @param {number} statusCode
   * @param {string} [code]   stable machine-readable code the client can branch on
   * @param {object} [details] extra fields merged into the JSON response
   */
  constructor(message, statusCode = 500, code, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || DEFAULT_CODES[statusCode] || 'INTERNAL_ERROR';
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
