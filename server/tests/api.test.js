const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let w;
before(async () => { w = await h.world({ attendees: 1, seats: 4 }); });
after(async () => { await h.sequelize.close(); });

const future = (days) => new Date(Date.now() + days * 86400000).toISOString();

test('auth: emails are case-insensitive; login returns the org name; wrong password is a clean 401', async () => {
  const reg = await h.api().post('/api/auth/register').send({ email: '  New.User@Test.com ', password: 'longenough1', confirmPassword: 'longenough1' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'new.user@test.com');
  const dup = await h.api().post('/api/auth/register').send({ email: 'NEW.USER@test.com', password: 'longenough1', confirmPassword: 'longenough1' });
  assert.equal(dup.status, 409);
  const login = await h.api().post('/api/auth/login').send({ email: 'NEW.user@TEST.com', password: 'longenough1' });
  assert.equal(login.status, 200);
  const org = await h.api().post('/api/auth/login').send({ email: 'org@test.com', password: 'password123' });
  assert.equal(org.body.user.orgName, 'Test Org');
  const bad = await h.api().post('/api/auth/login').send({ email: 'org@test.com', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, 'INVALID_CREDENTIALS');
});

test('roles: attendees cannot use organizer APIs; organizers cannot hold seats', async () => {
  const a = await h.api().get('/api/organizer/events').set(h.auth(w.users[0].token));
  assert.equal(a.status, 403);
  const b = await h.hold(w.org.token, w.event.id, [w.seatIds[0]]);
  assert.equal(b.status, 403);
});

test('organizer create: server enforces seat caps and field rules', async () => {
  const base = { title: 'Cap Test', category: 'Concert', city: 'Pune', venue: 'Hall', date: future(5) };
  const huge = await h.api().post('/api/organizer/events').set(h.auth(w.org.token))
    .send({ ...base, seatCategories: [{ name: 'A', price: 100, count: 200001 }] });
  assert.equal(huge.status, 400);
  const tooMany = await h.api().post('/api/organizer/events').set(h.auth(w.org.token))
    .send({ ...base, seatCategories: Array.from({ length: 11 }, (_, i) => ({ name: `C${i}`, price: 10, count: 1 })) });
  assert.equal(tooMany.status, 400);
  const dupNames = await h.api().post('/api/organizer/events').set(h.auth(w.org.token))
    .send({ ...base, seatCategories: [{ name: 'VIP', price: 10, count: 1 }, { name: 'vip', price: 10, count: 1 }] });
  assert.equal(dupNames.status, 400);
  const past = await h.api().post('/api/organizer/events').set(h.auth(w.org.token))
    .send({ ...base, date: '2001-01-01T00:00:00Z', seatCategories: [{ name: 'A', price: 10, count: 1 }] });
  assert.equal(past.status, 400);
  const ok = await h.api().post('/api/organizer/events').set(h.auth(w.org.token))
    .send({ ...base, seatCategories: [{ name: 'VIP', price: 1500, count: 16 }, { name: 'Standard', price: 600, count: 32 }] });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.event.totalSeats, 48);
});

test('organizer update: validates fields and can clear the description', async () => {
  const bad = await h.api().put(`/api/organizer/events/${w.event.id}`).set(h.auth(w.org.token)).send({ category: 'Opera' });
  assert.equal(bad.status, 400);
  const past = await h.api().put(`/api/organizer/events/${w.event.id}`).set(h.auth(w.org.token)).send({ date: '2001-01-01T00:00:00Z' });
  assert.equal(past.status, 400);
  await h.api().put(`/api/organizer/events/${w.event.id}`).set(h.auth(w.org.token)).send({ description: 'Some text' });
  const cleared = await h.api().put(`/api/organizer/events/${w.event.id}`).set(h.auth(w.org.token)).send({ description: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.description, null);
});

test("organizer can't delete an event while customers hold seats", async () => {
  const held = await h.hold(w.users[0].token, w.event.id, [w.seatIds[0]]);
  assert.equal(held.status, 201);
  const del = await h.api().delete(`/api/organizer/events/${w.event.id}`).set(h.auth(w.org.token));
  assert.equal(del.status, 409);
  assert.equal(del.body.code, 'EVENT_HAS_HOLDS');
});

test('dashboard and analytics answer with the expected shape', async () => {
  const d = await h.api().get('/api/organizer/dashboard').set(h.auth(w.org.token));
  assert.equal(d.status, 200);
  for (const k of ['totalEvents', 'totalBookings', 'totalRevenue', 'activeHolds', 'recentBookings']) assert.ok(k in d.body, k);
  assert.equal(d.body.activeHolds, 1);
  const a = await h.api().get('/api/organizer/analytics?eventId=all').set(h.auth(w.org.token));
  assert.equal(a.status, 200);
  assert.equal(a.body.daily.length, 21);
  const bad = await h.api().get('/api/organizer/analytics?eventId=abc').set(h.auth(w.org.token));
  assert.equal(bad.status, 400);
});

test('unknown routes are JSON 404s; health reports the DB', async () => {
  const r = await h.api().get('/api/nope');
  assert.equal(r.status, 404);
  const health = await h.api().get('/api/health');
  assert.equal(health.body.db, 'up');
});
