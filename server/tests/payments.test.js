const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let w;
before(async () => { w = await h.world({ attendees: 8, seats: 24 }); });
after(async () => { await h.sequelize.close(); });

let seatCursor = 0;
const nextSeats = (n) => w.seatIds.slice(seatCursor, (seatCursor += n));
const countPayments = async (holdGroupId) => h.models.Payment.count({ where: { hold_group_id: holdGroupId } });

test('happy path: pay -> booking, seats booked, hold gone', async () => {
  const u = w.users[0];
  const seats = nextSeats(2);
  const held = await h.hold(u.token, w.event.id, seats);
  const res = await h.pay(u.token, held.body.holdGroupId, 'happy-path-key-01');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'SUCCESS');
  assert.match(res.body.bookingCode, /^BK-\d{6}$/);
  assert.equal(res.body.amount, 1000);
  const rows = await h.seatRows(seats);
  assert.ok(rows.every((r) => r.status === 'booked' && r.booking_id === res.body.bookingId));
  assert.equal(await h.models.Hold.count({ where: { hold_group_id: held.body.holdGroupId } }), 0);

  const detail = await h.api().get(`/api/payments/${res.body.paymentId}`).set(h.auth(u.token));
  assert.equal(detail.body.event.title, 'Test Night');
  assert.equal(detail.body.seats.length, 2);
  const other = await h.api().get(`/api/payments/${res.body.paymentId}`).set(h.auth(w.users[1].token));
  assert.equal(other.status, 404, "another user can't read this payment");
});

test('same idempotency key sent 5 times at once: one charge, same answer', async () => {
  const u = w.users[1];
  const held = await h.hold(u.token, w.event.id, nextSeats(1));
  const key = 'dup-key-concurrent-01';
  const results = await Promise.all(Array.from({ length: 5 }, () => h.pay(u.token, held.body.holdGroupId, key)));
  results.forEach((r) => assert.ok([200, 202].includes(r.status), `${r.status} ${JSON.stringify(r.body)}`));
  assert.equal(new Set(results.map((r) => r.body.paymentId)).size, 1, 'all point at the same payment');
  assert.equal(await countPayments(held.body.holdGroupId), 1);
  const replay = await h.pay(u.token, held.body.holdGroupId, key);
  assert.equal(replay.body.status, 'SUCCESS');
  assert.equal(replay.body.replayed, true);
});

test('two different keys for one hold at once: charged once, never twice', async () => {
  const u = w.users[2];
  const held = await h.hold(u.token, w.event.id, nextSeats(1));
  const [a, b] = await Promise.all([
    h.pay(u.token, held.body.holdGroupId, 'two-keys-aaaa-01'),
    h.pay(u.token, held.body.holdGroupId, 'two-keys-bbbb-01'),
  ]);
  const ok = [a, b].filter((r) => r.status === 200 && r.body.status === 'SUCCESS');
  const blocked = [a, b].filter((r) => r.status === 409 || r.status === 404);
  assert.equal(ok.length, 1, JSON.stringify([a.body, b.body]));
  assert.equal(blocked.length, 1, JSON.stringify([a.body, b.body]));
  const refunds = await h.models.Payment.count({ where: { hold_group_id: held.body.holdGroupId, status: 'REFUND_PENDING' } });
  assert.equal(refunds, 0, 'no second charge that needs refunding');
});

test('declined payment can be retried with the SAME key; still one payment row', async () => {
  const u = w.users[3];
  const held = await h.hold(u.token, w.event.id, nextSeats(1));
  const key = 'retry-same-key-01';
  const first = await h.pay(u.token, held.body.holdGroupId, key, { 'X-Simulate-Payment': 'decline' });
  assert.equal(first.status, 200);
  assert.equal(first.body.status, 'FAILED');
  assert.ok(first.body.failureReason);

  const [holdRow] = await h.seatRows(held.body.seats.map((s) => s.id));
  assert.equal(holdRow.status, 'held', 'seat stays held after a decline');

  const retry = await h.pay(u.token, held.body.holdGroupId, key);
  assert.equal(retry.body.status, 'SUCCESS');
  assert.equal(retry.body.paymentId, first.body.paymentId);
  assert.equal(retry.body.attempts, 2);
  assert.equal(await countPayments(held.body.holdGroupId), 1);
});

test('the old body flag cannot force a failure', async () => {
  const u = w.users[4];
  const held = await h.hold(u.token, w.event.id, nextSeats(1));
  const res = await h.api().post('/api/payments').set(h.auth(u.token))
    .send({ holdGroupId: held.body.holdGroupId, idempotencyKey: 'body-flag-key-01', simulateFailure: true });
  assert.equal(res.body.status, 'SUCCESS');
});

test("an idempotency key can't be reused by someone else", async () => {
  const [u, v] = [w.users[5], w.users[6]];
  const h1 = await h.hold(u.token, w.event.id, nextSeats(1));
  await h.pay(u.token, h1.body.holdGroupId, 'shared-key-0001');
  const h2 = await h.hold(v.token, w.event.id, nextSeats(1));
  const res = await h.pay(v.token, h2.body.holdGroupId, 'shared-key-0001');
  assert.equal(res.status, 422);
  assert.equal(res.body.code, 'IDEMPOTENCY_KEY_REUSED');
});

test('paying for an expired hold: 410, nothing charged', async () => {
  const u = w.users[7];
  const held = await h.hold(u.token, w.event.id, nextSeats(1));
  await h.sequelize.query(`UPDATE holds SET expires_at = now() - interval '1 second' WHERE hold_group_id = :g`, {
    replacements: { g: held.body.holdGroupId },
  });
  const res = await h.pay(u.token, held.body.holdGroupId, 'expired-hold-key-01');
  assert.equal(res.status, 410);
  assert.equal(res.body.code, 'HOLD_EXPIRED');
  assert.equal(await countPayments(held.body.holdGroupId), 0);
});

test('invariants hold after everything above', async () => {
  assert.deepEqual(await h.checkInvariants(), []);
});
