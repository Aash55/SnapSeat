// Tiny input validators. Every value that reaches SQL is checked here first, so bad input is a
// 400 with a clear message instead of a 500 carrying a raw Postgres error.
const AppError = require('./AppError');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bad = (message, field) => new AppError(message, 400, 'VALIDATION_ERROR', field ? { field } : undefined);

function id(value, field = 'id') {
  const n = typeof value === 'number' ? value : /^\d+$/.test(String(value ?? '')) ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0) throw bad(`${field} must be a positive integer`, field);
  return n;
}

function uuid(value, field = 'id') {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw bad(`${field} must be a valid id`, field);
  return value.toLowerCase();
}

function email(value) {
  const e = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(e) || e.length > 254) throw bad('Enter a valid email address', 'email');
  return e;
}

function string(value, field, { min = 1, max = 255, optional = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null;
    throw bad(`${field} is required`, field);
  }
  if (typeof value !== 'string') throw bad(`${field} must be text`, field);
  const s = value.trim();
  if (s.length < min) throw bad(`${field} is required`, field);
  if (s.length > max) throw bad(`${field} must be at most ${max} characters`, field);
  return s;
}

function futureDate(value, field = 'date') {
  const d = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(d.getTime())) throw bad(`${field} must be a valid date`, field);
  if (d.getTime() <= Date.now()) throw bad('Date must be in the future', field);
  return d;
}

function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw bad(`${field} must be one of: ${allowed.join(', ')}`, field);
  return value;
}

module.exports = { id, uuid, email, string, futureDate, oneOf, bad, UUID_RE };
