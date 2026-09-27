// The race that matters most: a payment confirmation arriving around the moment a hold expires.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const booking = require('../services/bookingService');
const gateway = require('../services/fakeGateway');

let w;
before(async () => { w = await h.world({ attendees: 4, seats: 60 }); });
after(async () => { await h.sequelize.close(); });

let cursor = 0;
const take = (n) => w.seatIds.slice(cursor, (cursor += n));
const expire = (g) => h.sequelize.query(`UPDATE holds SET expires_at = now() - interval '1 second' WHERE hold_group_id = :g`, { replacements: { g } });

/** Hold + reserved PENDING payment, the state right before the gateway answers. */
async function pendingPayment(user, n = 1) {
  const held = await h.hold(user.token, w.event.id, take(n));
  assert.equal(held.status, 201);
  const { payment } = await booking.reservePayment({
    userId: user.id, holdGroupId: held.body.holdGroupId, idempotencyKey: `race-${held.body.holdGroupId}`,
  });
  return { holdGroupId: held.body.holdGroupId, seatIds: held.body.seats.map((s) => s.id), payment };
}

const successEvent = (payment) => ({
  gatewayEventId: `evt-${payment.id}-${Math.random()}`, gatewayPaymentId: `gw-${payment.id}`,
  reference: String(payment.id), status: 'SUCCESS', amount: Number(payment.amount),
});

test('money arrives after the hold expired -> REFUND_PENDING, seats untouched, no booking', async () => {
  const p = await pendingPayment(w.users[0], 2);
  await expire(p.holdGroupId);
  const out = await booking.applyGatewayEvent(successEvent(p.payment));
  assert.equal(out.status, 'REFUND_PENDING');
  const rows = await h.seatRows(p.seatIds);
  assert.ok(rows.every((r) => r.status === 'held' && r.booking_id === null), 'seats not claimed or freed by the webhook');
  assert.equal(await h.models.Booking.count({ where: { hold_group_id: p.holdGroupId } }), 0);

  await booking.sweepExpiredHolds();
  const after = await h.seatRows(p.seatIds);
  assert.ok(after.every((r) => r.status === 'free'), 'the sweeper frees them afterwards');
});

test('the sweeper never frees a booked seat (the original double-sell bug)', async () => {
  const p = await pendingPayment(w.users[1]);
  const out = await booking.applyGatewayEvent(successEvent(p.payment));
  assert.equal(out.status, 'SUCCESS');
  // Recreate the old interleaving: a stale, expired hold row still pointing at the booked seat,
  // exactly what the old worker had read just before the booking committed.
  await h.models.Hold.create({ hold_group_id: p.holdGroupId, user_id: w.users[1].id, seat_id: p.seatIds[0], expires_at: new Date(Date.now() - 1000) });
  await booking.sweepExpiredHolds();
  const [row] = await h.seatRows(p.seatIds);
  assert.equal(row.status, 'booked');
  assert.ok(row.booking_id);
});

test('the sweeper skips a hold a payment transaction is deciding on (SKIP LOCKED)', async () => {
  const p = await pendingPayment(w.users[2]);
  await expire(p.holdGroupId);
  const t = await h.sequelize.transaction();
  try {
    await h.sequelize.query('SELECT id FROM holds WHERE hold_group_id = :g FOR UPDATE', { replacements: { g: p.holdGroupId }, transaction: t });
    const res = await booking.sweepExpiredHolds(); // must not block, must not touch these rows
    assert.equal(res.freedSeats, 0);
  } finally {
    await t.rollback();
  }
  const res = await booking.sweepExpiredHolds();
  assert.equal(res.freedSeats, 1);
});

test('the same gateway event delivered twice is applied once', async () => {
  const p = await pendingPayment(w.users[3]);
  const evt = successEvent(p.payment);
  const [a, b] = await Promise.all([booking.applyGatewayEvent(evt), booking.applyGatewayEvent(evt)]);
  const outcomes = [a, b].map((o) => (o.duplicate ? 'dup' : o.status)).sort();
  assert.deepEqual(outcomes, ['SUCCESS', 'dup']);
  assert.equal(await h.models.Booking.count({ where: { hold_group_id: p.holdGroupId } }), 1);
});

test('stress: 25 payments landing around expiry, with sweeps firing concurrently', async () => {
  for (let i = 0; i < 25; i++) {
    const user = w.users[i % w.users.length];
    const held = await h.hold(user.token, w.event.id, take(1));
    assert.equal(held.status, 201, JSON.stringify(held.body));
    // Hold expires somewhere inside the gateway's response window.
    await h.sequelize.query(`UPDATE holds SET expires_at = now() + (:ms || ' milliseconds')::interval WHERE hold_group_id = :g`, {
      replacements: { ms: String(5 + (i % 5) * 10), g: held.body.holdGroupId },
    });
    const payP = booking.startPayment({ userId: user.id, holdGroupId: held.body.holdGroupId, idempotencyKey: `stress-key-${i}` }).catch((e) => e);
    const sweeps = Array.from({ length: 6 }, (_, k) => new Promise((r) => setTimeout(r, k * 8)).then(() => booking.sweepExpiredHolds()));
    const [res] = await Promise.all([payP, ...sweeps]);
    if (res instanceof Error) assert.ok(['HOLD_EXPIRED', 'HOLD_NOT_FOUND'].includes(res.code), res.message);
    else assert.ok(['SUCCESS', 'REFUND_PENDING'].includes(res.status), res.status);
  }
  await booking.sweepExpiredHolds();
  assert.deepEqual(await h.checkInvariants(), []);
});

test('webhook route: only correctly signed, fresh events are accepted', async () => {
  const p = await pendingPayment(w.users[0]);
  const body = JSON.stringify(successEvent(p.payment));

  const unsigned = await h.api().post('/api/webhooks/payment').set('Content-Type', 'application/json').send(body);
  assert.equal(unsigned.status, 401);

  const stale = gateway.sign(body, Math.floor(Date.now() / 1000) - 3600);
  const old = await h.api().post('/api/webhooks/payment').set('Content-Type', 'application/json').set('X-SnapSeat-Signature', stale).send(body);
  assert.equal(old.status, 401);

  const tampered = body.replace('"SUCCESS"', '"SUCCESS" ');
  const bad = await h.api().post('/api/webhooks/payment').set('Content-Type', 'application/json').set('X-SnapSeat-Signature', gateway.sign(body)).send(tampered);
  assert.equal(bad.status, 401);

  const good = await h.api().post('/api/webhooks/payment').set('Content-Type', 'application/json').set('X-SnapSeat-Signature', gateway.sign(body)).send(body);
  assert.equal(good.status, 200);
  assert.equal(good.body.status, 'SUCCESS');
});
