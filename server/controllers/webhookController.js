const gateway = require('../services/fakeGateway');
const { applyGatewayEvent } = require('../services/bookingService');

// Mounted with express.raw(), so req.body is the exact bytes the gateway signed.
exports.handlePaymentWebhook = async (req, res, next) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!gateway.verify(rawBody, req.get('X-SnapSeat-Signature'))) {
      return res.status(401).json({ error: 'Invalid signature', code: 'BAD_SIGNATURE' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Body is not valid JSON', code: 'BAD_JSON' });
    }
    const { gatewayEventId, gatewayPaymentId, reference, status, amount } = event || {};
    if (!gatewayEventId || !reference || !status) {
      return res.status(400).json({ error: 'Missing event fields', code: 'VALIDATION_ERROR' });
    }

    const outcome = await applyGatewayEvent({ gatewayEventId, gatewayPaymentId, reference, status, amount });
    res.json({ received: true, ...outcome });
  } catch (err) {
    // A 5xx tells the gateway to retry later; duplicates are safe because events are de-duplicated.
    next(err);
  }
};
