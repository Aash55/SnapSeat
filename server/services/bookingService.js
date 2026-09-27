// SnapSeat booking core: holds, payments, gateway events and hold expiry.
//
// Concurrency rules this file relies on (read these before changing anything):
//
//  1. Row locks are always taken in the same order:  payments -> holds -> seats.
//     Every transaction below follows it, so two of them can never wait on each other in a cycle.
//  2. A seat's status only moves  free -> held  (createHold),  held -> booked  (gateway success)
//     or  held -> free  (release / expiry). Every write that frees a seat is guarded with
//     `status = 'held'`, so it can never overwrite a booked seat.
//  3. The database enforces the money rules, not just this code:
//       - holds.seat_id is UNIQUE              -> a seat is held by at most one hold
//       - payments_one_live_per_hold (partial) -> a hold has at most one PENDING/SUCCESS payment
//       - bookings.hold_group_id is UNIQUE     -> a hold becomes at most one booking
//       - payments.idempotency_key is UNIQUE   -> a retried request can't create a second charge
//  4. No row lock is held while we wait on the payment gateway (network call).
const { QueryTypes, Op, UniqueConstraintError } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { sequelize, Hold, Seat, Event, Booking, Payment } = require('../models');
const AppError = require('../utils/AppError');
const gateway = require('./fakeGateway');
const { HOLD_TTL_SECONDS, HOLD_MAX_SEATS, PAYMENT_STATUS } = require('../utils/constants');

const ADVISORY_NS_HOLD = 7301; // namespace for per-user advisory locks

const eventSummary = (e) => e && ({ id: e.id, title: e.title, venue: e.venue, city: e.city, date: e.date });
const bookingCode = (id) => (id ? `BK-${String(id).padStart(6, '0')}` : null);

/** Seats with their category, plus each category's position within the event (for colours). */
async function loadSeats(seatIds, transaction) {
  if (!seatIds.length) return [];
  return sequelize.query(
    `SELECT s.id, s.seat_number, s.status, s.event_id, c.id AS category_id, c.name AS category, c.price,
            (SELECT COUNT(*) FROM seat_categories c2 WHERE c2.event_id = c.event_id AND c2.id < c.id)::int AS category_index
       FROM seats s JOIN seat_categories c ON c.id = s.category_id
      WHERE s.id IN (:seatIds)
      ORDER BY s.id`,
    { replacements: { seatIds }, type: QueryTypes.SELECT, transaction }
  );
}

const seatDto = (s) => ({
  id: s.id,
  seatNumber: s.seat_number,
  categoryId: s.category_id,
  categoryName: s.category,
  categoryIndex: s.category_index,
  price: Number(s.price),
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Holds
// ─────────────────────────────────────────────────────────────────────────────────────────────

async function findActiveHold(userId, transaction) {
  const rows = await sequelize.query(
    `SELECT h.hold_group_id, MIN(h.expires_at) AS expires_at, MIN(s.event_id) AS event_id,
            ARRAY_AGG(h.seat_id ORDER BY h.seat_id) AS seat_ids
       FROM holds h JOIN seats s ON s.id = h.seat_id
      WHERE h.user_id = :userId AND h.expires_at > now()
      GROUP BY h.hold_group_id
      LIMIT 1`,
    { replacements: { userId }, type: QueryTypes.SELECT, transaction }
  );
  return rows[0] || null;
}

async function createHold({ userId, eventId, seatIds }) {
  return sequelize.transaction(async (transaction) => {
    // One hold per user at a time. The advisory lock serialises a user's own concurrent requests
    // (double-click, two tabs) so the "already has a hold" check below can't be raced.
    await sequelize.query('SELECT pg_advisory_xact_lock(:ns, :userId)', {
      replacements: { ns: ADVISORY_NS_HOLD, userId }, transaction,
    });

    const active = await findActiveHold(userId, transaction);
    if (active) {
      throw new AppError('You already have seats on hold. Finish checkout or release them first.', 409, 'ACTIVE_HOLD_EXISTS', {
        holdGroupId: active.hold_group_id,
        eventId: active.event_id,
      });
    }

    const event = await Event.findByPk(eventId, { transaction });
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    if (new Date(event.date).getTime() <= Date.now()) {
      throw new AppError('This event has already started, so seats are no longer on sale.', 409, 'EVENT_ENDED');
    }

    // Expire stale holds on exactly these seats right now instead of waiting for the sweeper.
    // Locks those hold rows first (holds -> seats order), then frees only seats still 'held'.
    const reclaimed = await sequelize.query(
      `DELETE FROM holds WHERE seat_id IN (:seatIds) AND expires_at <= now() RETURNING seat_id`,
      { replacements: { seatIds }, type: QueryTypes.SELECT, transaction }
    );
    if (reclaimed.length) {
      await sequelize.query(
        `UPDATE seats SET status = 'free', updated_at = now() WHERE id IN (:ids) AND status = 'held'`,
        { replacements: { ids: reclaimed.map((r) => r.seat_id) }, transaction }
      );
    }

    // Lock the requested seats (sorted by id, so concurrent holds lock in the same order).
    const locked = await sequelize.query(
      `SELECT id, seat_number, status FROM seats WHERE id IN (:seatIds) AND event_id = :eventId ORDER BY id FOR UPDATE`,
      { replacements: { seatIds, eventId }, type: QueryTypes.SELECT, transaction }
    );
    if (locked.length !== seatIds.length) {
      throw new AppError('One or more seats do not belong to this event', 404, 'SEAT_NOT_FOUND');
    }
    const taken = locked.filter((s) => s.status !== 'free');
    if (taken.length) {
      throw new AppError(
        `${taken.map((s) => s.seat_number).join(', ')} ${taken.length === 1 ? 'was' : 'were'} just taken by someone else.`,
        409,
        'SEAT_UNAVAILABLE',
        { unavailableSeatIds: taken.map((s) => s.id), unavailableSeats: taken.map((s) => s.seat_number) }
      );
    }

    const holdGroupId = uuidv4();
    const expiresAt = new Date(Date.now() + HOLD_TTL_SECONDS * 1000);
    await Hold.bulkCreate(
      seatIds.map((seatId) => ({ hold_group_id: holdGroupId, user_id: userId, seat_id: seatId, expires_at: expiresAt })),
      { transaction }
    );
    await Seat.update({ status: 'held' }, { where: { id: { [Op.in]: seatIds } }, transaction });

    const seats = (await loadSeats(seatIds, transaction)).map(seatDto);
    return {
      holdGroupId,
      eventId,
      seats,
      totalAmount: seats.reduce((sum, s) => sum + s.price, 0),
      expiresAt,
      ttlSeconds: HOLD_TTL_SECONDS,
      holdTtlSeconds: HOLD_TTL_SECONDS,
    };
  });
}

async function getHold({ userId, holdGroupId }) {
  const holds = await sequelize.query(
    `SELECT seat_id, expires_at, (expires_at > now()) AS alive,
            GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS ttl
       FROM holds WHERE hold_group_id = :holdGroupId AND user_id = :userId ORDER BY seat_id`,
    { replacements: { holdGroupId, userId }, type: QueryTypes.SELECT }
  );
  const lastPayment = await Payment.findOne({
    where: { hold_group_id: holdGroupId, user_id: userId },
    order: [['updated_at', 'DESC']],
  });

  if (!holds.length) {
    // Hold rows are gone: either it was paid for (booking made / refund pending) or it expired
    // and was swept. Tell the client which, so checkout can route to the right screen.
    if (lastPayment && lastPayment.status !== PAYMENT_STATUS.FAILED) {
      return { holdGroupId, status: 'consumed', paymentId: lastPayment.id, paymentStatus: lastPayment.status };
    }
    throw new AppError('This hold has expired or does not exist', 404, 'HOLD_NOT_FOUND');
  }

  const seatRows = await loadSeats(holds.map((h) => h.seat_id));
  const seats = seatRows.map(seatDto);
  const event = await Event.findByPk(seatRows[0].event_id);
  const alive = holds.every((h) => h.alive);
  return {
    holdGroupId,
    status: alive ? 'active' : 'expired',
    expiresAt: holds[0].expires_at,
    ttlSeconds: alive ? Math.min(...holds.map((h) => h.ttl)) : 0,
    holdTtlSeconds: HOLD_TTL_SECONDS,
    event: eventSummary(event),
    seats,
    totalAmount: seats.reduce((sum, s) => sum + s.price, 0),
    payment: lastPayment ? {
      id: lastPayment.id, status: lastPayment.status, attempts: lastPayment.attempts, failureReason: lastPayment.failure_reason,
    } : null,
  };
}

async function releaseHold({ userId, holdGroupId }) {
  return sequelize.transaction(async (transaction) => {
    const holds = await sequelize.query(
      `SELECT id, seat_id FROM holds WHERE hold_group_id = :holdGroupId AND user_id = :userId FOR UPDATE`,
      { replacements: { holdGroupId, userId }, type: QueryTypes.SELECT, transaction }
    );
    if (!holds.length) throw new AppError('Hold not found', 404, 'HOLD_NOT_FOUND');

    const inFlight = await Payment.count({ where: { hold_group_id: holdGroupId, status: PAYMENT_STATUS.PENDING }, transaction });
    if (inFlight) {
      throw new AppError('A payment for these seats is still being processed.', 409, 'PAYMENT_IN_PROGRESS');
    }

    await Hold.destroy({ where: { hold_group_id: holdGroupId }, transaction });
    await sequelize.query(
      `UPDATE seats SET status = 'free', updated_at = now() WHERE id IN (:ids) AND status = 'held'`,
      { replacements: { ids: holds.map((h) => h.seat_id) }, transaction }
    );
    return { released: holds.length };
  });
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────────────────────────────

const paymentResult = (p, extra = {}) => ({
  paymentId: p.id,
  status: p.status,
  amount: Number(p.amount),
  attempts: p.attempts,
  bookingId: p.booking_id,
  bookingCode: bookingCode(p.booking_id),
  failureReason: p.failure_reason,
  ...extra,
});

/**
 * Phase 1 of a payment, in one short transaction: decide whether this request is
 *   - a replay of an earlier request with the same key  -> return the stored result, charge nothing
 *   - a retry of a DECLINED attempt with the same key     -> reuse the same payment row
 *   - a brand-new payment                                 -> insert a PENDING row
 */
async function reservePayment({ userId, holdGroupId, idempotencyKey }) {
  return sequelize.transaction(async (transaction) => {
    const existing = await Payment.findOne({ where: { idempotency_key: idempotencyKey }, lock: transaction.LOCK.UPDATE, transaction });

    if (existing) {
      if (existing.user_id !== userId || existing.hold_group_id !== holdGroupId) {
        throw new AppError('This idempotency key was already used for a different payment.', 422, 'IDEMPOTENCY_KEY_REUSED');
      }
      if (existing.status !== PAYMENT_STATUS.FAILED) return { payment: existing, replayed: true };
    }

    const holds = await sequelize.query(
      `SELECT seat_id, (expires_at > now()) AS alive FROM holds
        WHERE hold_group_id = :holdGroupId AND user_id = :userId ORDER BY seat_id FOR UPDATE`,
      { replacements: { holdGroupId, userId }, type: QueryTypes.SELECT, transaction }
    );
    if (!holds.length) throw new AppError('This hold has expired or does not exist', 404, 'HOLD_NOT_FOUND');
    if (!holds.every((h) => h.alive)) {
      throw new AppError('Your hold expired before payment. Nothing was charged.', 410, 'HOLD_EXPIRED');
    }

    if (existing) {
      // Retry after a decline: same row, same key, so the client's "you won't be charged twice"
      // promise holds even if the retry request itself is sent twice.
      existing.status = PAYMENT_STATUS.PENDING;
      existing.attempts += 1;
      existing.failure_reason = null;
      await existing.save({ transaction });
      return { payment: existing, replayed: false };
    }

    const seats = await loadSeats(holds.map((h) => h.seat_id), transaction);
    const snapshot = seats.map((s) => ({
      seatId: s.id, seatNumber: s.seat_number, category: s.category, categoryIndex: s.category_index, price: Number(s.price),
    }));
    const payment = await Payment.create({
      status: PAYMENT_STATUS.PENDING,
      user_id: userId,
      event_id: seats[0].event_id,
      hold_group_id: holdGroupId,
      idempotency_key: idempotencyKey,
      amount: snapshot.reduce((sum, s) => sum + s.price, 0),
      seat_snapshot: snapshot,
    }, { transaction });
    return { payment, replayed: false };
  });
}

async function startPayment({ userId, holdGroupId, idempotencyKey, simulateDecline = false }) {
  let reserved;
  try {
    reserved = await reservePayment({ userId, holdGroupId, idempotencyKey });
  } catch (err) {
    if (!(err instanceof UniqueConstraintError)) throw err;
    // Lost a race. Which unique index fired tells us what happened:
    if (err.parent?.constraint !== 'payments_one_live_per_hold') {
      // idempotency_key: the same request was sent twice at the same moment -> replay the winner
      const byKey = await Payment.findOne({ where: { idempotency_key: idempotencyKey } });
      if (byKey && byKey.user_id === userId && byKey.hold_group_id === holdGroupId) {
        return paymentResult(byKey, { replayed: true });
      }
    }
    const live = await Payment.findOne({ where: { hold_group_id: holdGroupId, status: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.SUCCESS] } });
    throw new AppError('A payment for these seats is already in progress or complete.', 409, 'PAYMENT_IN_PROGRESS', {
      paymentId: live?.id,
    });
  }

  const { payment, replayed } = reserved;
  if (replayed) return paymentResult(payment, { replayed: true });

  // Phase 2: talk to the gateway with no locks held.
  const result = await gateway.charge({ amount: Number(payment.amount), reference: String(payment.id), decline: simulateDecline });

  if (!result.success) {
    await Payment.update(
      { status: PAYMENT_STATUS.FAILED, failure_reason: result.reason },
      { where: { id: payment.id, status: PAYMENT_STATUS.PENDING } }
    );
    await payment.reload();
    return paymentResult(payment, { replayed: false });
  }

  // The gateway would POST this to /api/webhooks/payment. We apply it in-process through the
  // exact same code path (and signature check) that the webhook route uses.
  if (!gateway.verify(result.rawBody, result.signature)) throw new Error('Gateway signature check failed');
  await applyGatewayEvent(result.event);
  await payment.reload();
  return paymentResult(payment, { replayed: false });
}

/**
 * Phase 3: the gateway says money moved. One transaction decides the outcome:
 *   hold still alive and all seats still 'held'  -> PENDING -> SUCCESS, booking created, seats booked
 *   otherwise (hold expired / swept)             -> PENDING -> REFUND_PENDING, seats NOT touched
 * Duplicate deliveries of the same gateway event are ignored.
 */
async function applyGatewayEvent({ gatewayEventId, gatewayPaymentId, reference, status, amount }) {
  return sequelize.transaction(async (transaction) => {
    const payment = await Payment.findByPk(Number(reference), { lock: transaction.LOCK.UPDATE, transaction });
    if (!payment) return { ignored: 'unknown payment' };

    const inserted = await sequelize.query(
      `INSERT INTO webhook_events (gateway_event_id, payment_id, payload, processed_at, created_at)
       VALUES (:gatewayEventId, :paymentId, :payload, now(), now())
       ON CONFLICT (gateway_event_id) DO NOTHING RETURNING id`,
      {
        replacements: {
          gatewayEventId, paymentId: payment.id,
          payload: JSON.stringify({ gatewayEventId, gatewayPaymentId, reference, status, amount }),
        },
        type: QueryTypes.SELECT, transaction,
      }
    );
    if (!inserted.length) return { duplicate: true, status: payment.status };
    if (payment.status !== PAYMENT_STATUS.PENDING) return { alreadyFinal: true, status: payment.status };

    payment.gateway_payment_id = gatewayPaymentId;

    if (status !== 'SUCCESS') {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failure_reason = 'Declined by gateway';
      await payment.save({ transaction });
      return { status: payment.status };
    }

    const refund = async (reason) => {
      payment.status = PAYMENT_STATUS.REFUND_PENDING;
      payment.failure_reason = reason;
      await payment.save({ transaction });
      return { status: payment.status };
    };

    if (Number(amount) !== Number(payment.amount)) return refund('Amount did not match the order');

    const holds = await sequelize.query(
      `SELECT id, seat_id, (expires_at > now()) AS alive FROM holds
        WHERE hold_group_id = :holdGroupId ORDER BY seat_id FOR UPDATE`,
      { replacements: { holdGroupId: payment.hold_group_id }, type: QueryTypes.SELECT, transaction }
    );
    const expected = (payment.seat_snapshot || []).map((s) => s.seatId).sort((a, b) => a - b);
    const held = holds.map((h) => h.seat_id);
    const holdIntact = holds.length > 0 && holds.every((h) => h.alive)
      && held.length === expected.length && held.every((id, i) => id === expected[i]);
    if (!holdIntact) return refund('Hold expired before the payment completed');

    const seats = await sequelize.query(
      `SELECT id, status, event_id FROM seats WHERE id IN (:ids) ORDER BY id FOR UPDATE`,
      { replacements: { ids: held }, type: QueryTypes.SELECT, transaction }
    );
    if (!seats.every((s) => s.status === 'held')) return refund('Seats were no longer held');

    const booking = await Booking.create({
      status: 'CONFIRMED',
      total_amount: payment.amount,
      user_id: payment.user_id,
      event_id: seats[0].event_id,
      hold_group_id: payment.hold_group_id,
    }, { transaction });
    await sequelize.query(
      `UPDATE seats SET status = 'booked', booking_id = :bookingId, updated_at = now() WHERE id IN (:ids) AND status = 'held'`,
      { replacements: { bookingId: booking.id, ids: held }, transaction }
    );
    await Hold.destroy({ where: { hold_group_id: payment.hold_group_id }, transaction });

    payment.status = PAYMENT_STATUS.SUCCESS;
    payment.booking_id = booking.id;
    await payment.save({ transaction });
    return { status: payment.status, bookingId: booking.id };
  });
}

async function getPaymentForUser({ userId, paymentId }) {
  const payment = await Payment.findOne({
    where: { id: paymentId, user_id: userId },
    include: [{ model: Event, as: 'event' }, { model: Booking, as: 'booking' }],
  });
  if (!payment) throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
  return {
    ...paymentResult(payment),
    holdGroupId: payment.hold_group_id,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    event: eventSummary(payment.event),
    booking: payment.booking ? { id: payment.booking.id, status: payment.booking.status, createdAt: payment.booking.createdAt } : null,
    seats: (payment.seat_snapshot || []).map((s) => ({
      id: s.seatId, seatNumber: s.seatNumber, categoryName: s.category, categoryIndex: s.categoryIndex ?? 0, price: s.price,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Expiry sweeper
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Frees seats whose hold ran out. One statement, so it is atomic on its own:
 *  - SKIP LOCKED leaves alone any hold a payment transaction is deciding on right now;
 *    that transaction will see the expiry itself and refund. The next sweep frees the seats.
 *  - `status = 'held'` guarantees a booked seat is never flipped back to free.
 */
async function sweepExpiredHolds() {
  const freed = await sequelize.query(
    `WITH expired AS (
       DELETE FROM holds
        WHERE id IN (SELECT id FROM holds WHERE expires_at <= now() FOR UPDATE SKIP LOCKED)
       RETURNING seat_id
     )
     UPDATE seats SET status = 'free', updated_at = now()
      WHERE id IN (SELECT seat_id FROM expired) AND status = 'held'
     RETURNING id`,
    { type: QueryTypes.SELECT }
  );
  // A payment stuck in PENDING (server crashed mid-charge) must not block its hold forever.
  const [, staleCount] = await sequelize.query(
    `UPDATE payments SET status = 'FAILED', failure_reason = 'Timed out waiting for the gateway', updated_at = now()
      WHERE status = 'PENDING' AND updated_at < now() - interval '10 minutes'`
  );
  return { freedSeats: freed.length, stalePayments: staleCount?.rowCount ?? 0 };
}

module.exports = {
  HOLD_MAX_SEATS,
  createHold,
  getHold,
  releaseHold,
  findActiveHold,
  reservePayment,
  startPayment,
  applyGatewayEvent,
  getPaymentForUser,
  sweepExpiredHolds,
  bookingCode,
};
