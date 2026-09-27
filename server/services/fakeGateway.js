// A stand-in for a real payment gateway (Razorpay / Stripe style).
//
// Real gateways confirm a payment by calling OUR webhook with a signed payload. The signature is
// an HMAC of "<timestamp>.<raw body>" with a secret only the gateway and we know, so nobody else
// can forge a "payment succeeded" event. This module plays the gateway's side of that contract.
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { webhookSecret } = require('../config');

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function sign(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const mac = crypto.createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${mac}`;
}

/** Returns true only for a fresh, correctly signed payload. Constant-time comparison. */
function verify(rawBody, header) {
  if (typeof header !== 'string' || typeof rawBody !== 'string') return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=').map((x) => x.trim())));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(parts.v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Charges `amount`. Resolves with the gateway's answer; on success also returns the signed
 * webhook event the gateway would POST to us.
 * @param {{ amount: number, reference: string, decline?: boolean }} opts
 */
async function charge({ amount, reference, decline = false, delayMs = Number(process.env.GATEWAY_DELAY_MS ?? 400) }) {
  await new Promise((r) => setTimeout(r, delayMs));
  if (decline) {
    return { success: false, reason: 'Card declined by issuing bank' };
  }
  const event = {
    gatewayEventId: `gw_evt_${uuidv4()}`,
    gatewayPaymentId: `gw_pay_${uuidv4()}`,
    reference,
    amount,
    status: 'SUCCESS',
  };
  const rawBody = JSON.stringify(event);
  return { success: true, event, rawBody, signature: sign(rawBody) };
}

module.exports = { charge, sign, verify };
