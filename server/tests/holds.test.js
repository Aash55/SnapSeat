const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let w;
before(async () => { w = await h.world({ attendees: 10, seats: 12 }); });
after(async () => { await h.sequelize.close(); });

test('10 users grabbing the same seat at once: exactly one wins', async () => {
  const seat = w.seatIds[0];
  const results = await Promise.all(w.users.map((u) => h.hold(u.token, w.event.id, [seat])));
  const codes = results.map((r) => r.status).sort();
  assert.equal(codes.filter((c) => c === 201).length, 1, `statuses: ${codes}`);
  assert.equal(codes.filter((c) => c === 409).length, 9);
  results.filter((r) => r.status === 409).forEach((r) => {
    assert.equal(r.body.code, 'SEAT_UNAVAILABLE');
    assert.deepEqual(r.body.unavailableSeatIds, [seat]);
  });
  const [row] = await h.seatRows([seat]);
  assert.equal(row.status, 'held');
  const [{ n }] = await h.sequelize.query('SELECT COUNT(*)::int AS n FROM holds WHERE seat_id = :seat', { replacements: { seat }, type: 'SELECT' });
  assert.equal(n, 1);
});

test('one user double-clicking Hold on different seats gets only one hold', async () => {
  const u = w.users[1];
  const [a, b] = await Promise.all([
    h.hold(u.token, w.event.id, [w.seatIds[1]]),
    h.hold(u.token, w.event.id, [w.seatIds[2]]),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [201, 409]);
  const loser = a.status === 409 ? a : b;
  assert.equal(loser.body.code, 'ACTIVE_HOLD_EXISTS');
  assert.ok(loser.body.holdGroupId, 'tells the client which hold to resume');
});

test('an expired hold is reclaimed immediately, without waiting for the sweeper', async () => {
  const [owner, other] = [w.users[2], w.users[3]];
  const seat = w.seatIds[3];
  const first = await h.hold(owner.token, w.event.id, [seat]);
  assert.equal(first.status, 201);
  await h.sequelize.query(`UPDATE holds SET expires_at = now() - interval '1 second' WHERE hold_group_id = :g`, {
    replacements: { g: first.body.holdGroupId },
  });

  const map = await h.api().get(`/api/events/${w.event.id}/seats`).set(h.auth(other.token));
  assert.equal(map.body.seats.find((s) => s.id === seat).status, 'free', 'seat map already shows it as free');

  const second = await h.hold(other.token, w.event.id, [seat]);
  assert.equal(second.status, 201);
});

test('releasing a hold frees the seats; a released hold cannot be paid', async () => {
  const u = w.users[4];
  const res = await h.hold(u.token, w.event.id, [w.seatIds[4], w.seatIds[5]]);
  assert.equal(res.status, 201);
  const rel = await h.api().delete(`/api/holds/${res.body.holdGroupId}`).set(h.auth(u.token));
  assert.equal(rel.status, 200);
  const rows = await h.seatRows([w.seatIds[4], w.seatIds[5]]);
  assert.ok(rows.every((r) => r.status === 'free'));
  const p = await h.pay(u.token, res.body.holdGroupId, 'key-released-0001');
  assert.equal(p.status, 404);
});

test('seats cannot be held for an event that already happened', async () => {
  const { event, seatIds } = await h.createEvent({ organizerId: w.org.id, seats: 2, daysAhead: 1 });
  await h.models.Event.update({ date: new Date(Date.now() - 3600_000) }, { where: { id: event.id } });
  const res = await h.hold(w.users[5].token, event.id, [seatIds[0]]);
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'EVENT_ENDED');
  const list = await h.api().get('/api/events');
  assert.ok(!list.body.some((e) => e.id === event.id), 'past events are not listed');
});

test('bad input is a 400, never a 500', async () => {
  const t = w.users[6].token;
  const cases = [
    await h.api().post('/api/holds').set(h.auth(t)).send({ eventId: 'x', seatIds: [1] }),
    await h.api().post('/api/holds').set(h.auth(t)).send({ eventId: w.event.id, seatIds: ['abc'] }),
    await h.api().post('/api/holds').set(h.auth(t)).send({ eventId: w.event.id, seatIds: [1, 2, 3, 4, 5] }),
    await h.api().post('/api/holds').set(h.auth(t)).send({ eventId: w.event.id, seatIds: [w.seatIds[6], w.seatIds[6]] }),
    await h.api().get('/api/holds/not-a-uuid').set(h.auth(t)),
    await h.api().get('/api/payments/undefined').set(h.auth(t)),
    await h.api().post('/api/holds').set(h.auth(t)).set('Content-Type', 'application/json').send('{bad json'),
  ];
  cases.forEach((r) => assert.equal(r.status, 400, JSON.stringify(r.body)));
  cases.forEach((r) => assert.ok(!/syntax|sequelize|postgres/i.test(r.body.error), r.body.error));
});
