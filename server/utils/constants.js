const ROLES = {
  ATTENDEE: 'attendee',
  ORGANIZER: 'organizer',
};

const EVENT_CATEGORIES = ['Concert', 'Comedy', 'Sports', 'Theatre'];

const SEAT_STATUS = {
  FREE: 'free',
  HELD: 'held',
  BOOKED: 'booked',
};

const BOOKING_STATUS = {
  CONFIRMED: 'CONFIRMED',
  REFUND_PENDING: 'REFUND_PENDING',
};

const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUND_PENDING: 'REFUND_PENDING',
};

// A hold reserves seats for this long. Checkout's countdown reads it from the API.
const HOLD_TTL_SECONDS = 5 * 60;
const HOLD_MAX_SEATS = 4;
const EXPIRY_WORKER_INTERVAL_SECONDS = 15;

// Limits that keep one organizer request from creating an unbounded number of rows.
const MAX_SEAT_CATEGORIES = 10;
const MAX_SEATS_PER_CATEGORY = 5000;
const MAX_SEATS_PER_EVENT = 20000;
const MAX_PRICE = 1000000;

module.exports = {
  ROLES,
  EVENT_CATEGORIES,
  SEAT_STATUS,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  HOLD_TTL_SECONDS,
  HOLD_MAX_SEATS,
  EXPIRY_WORKER_INTERVAL_SECONDS,
  MAX_SEAT_CATEGORIES,
  MAX_SEATS_PER_CATEGORY,
  MAX_SEATS_PER_EVENT,
  MAX_PRICE,
};
