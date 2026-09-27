const booking = require('../services/bookingService');
const v = require('../utils/validate');
const { allowTestPaymentHooks } = require('../config');

const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

exports.initiatePayment = async (req, res, next) => {
  try {
    const holdGroupId = v.uuid(req.body?.holdGroupId, 'holdGroupId');
    // The key may come from the standard header or the body; the header wins.
    const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotencyKey;
    if (typeof idempotencyKey !== 'string' || !KEY_RE.test(idempotencyKey)) {
      throw v.bad('idempotencyKey must be 8-100 characters (letters, digits, - or _)', 'idempotencyKey');
    }

    // Test hook: only a request header can ask the fake gateway to decline, and only when the
    // server allows test hooks (never in production by default). A body flag is ignored.
    const simulateDecline = allowTestPaymentHooks && req.get('X-Simulate-Payment') === 'decline';

    const result = await booking.startPayment({ userId: req.user.id, holdGroupId, idempotencyKey, simulateDecline });
    // 202 while the gateway hasn't answered yet (a concurrent duplicate of an in-flight request).
    res.status(result.status === 'PENDING' ? 202 : 200).json(result);
  } catch (err) {
    next(err);
  }
};

exports.getPayment = async (req, res, next) => {
  try {
    const paymentId = v.id(req.params.id, 'paymentId');
    res.json(await booking.getPaymentForUser({ userId: req.user.id, paymentId }));
  } catch (err) {
    next(err);
  }
};
