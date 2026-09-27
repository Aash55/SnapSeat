// Shared test setup. Tests run against a real Postgres database (snapseat_test), because the
// guarantees under test (row locks, SKIP LOCKED, unique indexes) only exist in the database.
process.env.NODE_ENV = 'test';
process.env.GATEWAY_DELAY_MS = process.env.GATEWAY_DELAY_MS || '30';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';

const { execSync } = require('child_process');
const path = require('path');
const bcrypt = require('bcryptjs');
const request = require('supertest');

const root = path.join(__dirname, '..');
execSync('npx sequelize-cli db:migrate', { cwd: root, env: { ...process.env, NODE_ENV: 'test' }, stdio: 'pipe' });

const app = require('../app');
const models = require('../models');
const { sequelize, User, Event, SeatCategory, Seat } = models;

const PASSWORD = 'password123';
let hash;

async function resetDb() {
  await sequelize.query(
    'TRUNCATE webhook_events, payments, holds, seats, bookings, seat_categories, events, users RESTART IDENTITY CASCADE'
  );
}

async function createUser(email, role = 'attendee', orgName = null) {
  hash = hash || (await bcrypt.hash(PASSWORD, 4));
  return User.create({ email, password_hash: hash, role, org_name: orgName });
}

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/** Organizer + an upcoming event with `seats` seats in one category priced 500. */
async function createEvent({ organizerId, seats = 8, daysAhead = 10, price = 500 }) {
  const event = await Event.create({
    organizer_id: organizerId, title: 'Test Night', category: 'Concert', city: 'Pune', venue: 'Hall 1',
    date: new Date(Date.now() + daysAhead * 86400000),
  });
  const cat = await SeatCategory.create({ event_id: event.id, name: 'Standard', price });
  const rows = Array.from({ length: seats }, (_, i) => ({ event_id: event.id, category_id: cat.id, seat_number: `A${i + 1}`, status: 'free' }));
  const created = await Seat.bulkCreate(rows, { returning: true });
  return { event, seatIds: created.map((s) => s.id) };
}

/** Standard world: 1 organizer, `attendees` attendees (tokens), one event. */
async function world({ attendees = 3, seats = 8 } = {}) {
  await resetDb();
  const org = await createUser('org@test.com', 'organizer', 'Test Org');
  const users = [];
  for (let i = 1; i <= attendees; i++) {
    const u = await createUser(`user${i}@test.com`);
    users.push({ id: u.id, token: await login(u.email) });
  }
  const { event, seatIds } = await createEvent({ organizerId: org.id, seats });
  return { org: { id: org.id, token: await login('org@test.com') }, users, event, seatIds };
}

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function hold(token, eventId, seatIds) {
  return api().post('/api/holds').set(auth(token)).send({ eventId, seatIds });
}

async function pay(token, holdGroupId, key, headers = {}) {
  return api().post('/api/payments').set(auth(token)).set(headers).send({ holdGroupId, idempotencyKey: key });
}

async function seatRows(ids) {
  return sequelize.query('SELECT id, status, booking_id FROM seats WHERE id IN (:ids) ORDER BY id', {
    replacements: { ids }, type: sequelize.QueryTypes.SELECT,
  });
}

/** Invariants that must hold after ANY sequence of operations. Returns a list of violations. */
async function checkInvariants() {
  const q = (sql) => sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });
  const problems = [];
  const bookedWithoutBooking = await q(`SELECT id FROM seats WHERE status = 'booked' AND booking_id IS NULL`);
  if (bookedWithoutBooking.length) problems.push(`booked seats without booking: ${bookedWithoutBooking.map((r) => r.id)}`);
  const bookingSeatNotBooked = await q(`SELECT id FROM seats WHERE booking_id IS NOT NULL AND status <> 'booked'`);
  if (bookingSeatNotBooked.length) problems.push(`seats of a booking that are not booked: ${bookingSeatNotBooked.map((r) => r.id)}`);
  const doubleSuccess = await q(`SELECT hold_group_id FROM payments WHERE status = 'SUCCESS' GROUP BY hold_group_id HAVING COUNT(*) > 1`);
  if (doubleSuccess.length) problems.push('a hold was charged successfully twice');
  const successNoBooking = await q(`SELECT id FROM payments WHERE status = 'SUCCESS' AND booking_id IS NULL`);
  if (successNoBooking.length) problems.push('successful payment without booking');
  const refundWithBooking = await q(`SELECT id FROM payments WHERE status = 'REFUND_PENDING' AND booking_id IS NOT NULL`);
  if (refundWithBooking.length) problems.push('refund-pending payment that also has a booking');
  const heldNoHold = await q(`SELECT s.id FROM seats s LEFT JOIN holds h ON h.seat_id = s.id WHERE s.status = 'held' AND h.id IS NULL`);
  if (heldNoHold.length) problems.push(`held seats with no hold row: ${heldNoHold.map((r) => r.id)}`);
  return problems;
}

module.exports = {
  app, models, sequelize, api, auth, hold, pay, login, createUser, createEvent, world, resetDb, seatRows, checkInvariants,
};
