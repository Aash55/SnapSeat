const { sweepExpiredHolds } = require('../services/bookingService');
const { EXPIRY_WORKER_INTERVAL_SECONDS } = require('../utils/constants');

let running = false;

// Holds are also expired lazily (seat map shows them free, createHold reclaims them), so this
// sweeper only has to keep the table tidy and release seats nobody has asked for yet.
async function tick() {
  if (running) return; // never overlap two sweeps
  running = true;
  try {
    const { freedSeats, stalePayments } = await sweepExpiredHolds();
    if (freedSeats || stalePayments) {
      console.log(`[hold-expiry] freed ${freedSeats} seat(s), timed out ${stalePayments} payment(s)`);
    }
  } catch (err) {
    console.error('[hold-expiry] sweep failed:', err.message);
  } finally {
    running = false;
  }
}

function startExpiryWorker() {
  console.log(`[hold-expiry] running every ${EXPIRY_WORKER_INTERVAL_SECONDS}s`);
  tick();
  return setInterval(tick, EXPIRY_WORKER_INTERVAL_SECONDS * 1000);
}

module.exports = { startExpiryWorker, tick };
