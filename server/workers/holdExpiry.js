const cron = require('node-cron');
const { Op } = require('sequelize');
const { sequelize, Hold, Seat } = require('../models');
const { SEAT_STATUS, EXPIRY_WORKER_INTERVAL_SECONDS } = require('../utils/constants');

const cleanupExpiredHolds = async () => {
  const t = await sequelize.transaction();
  try {
    // Find all expired holds
    const expiredHolds = await Hold.findAll({
      where: {
        expires_at: { [Op.lt]: new Date() },
      },
      attributes: ['id', 'seat_id', 'hold_group_id'],
      transaction: t,
    });

    if (expiredHolds.length === 0) {
      await t.commit();
      return;
    }

    const expiredSeatIds = expiredHolds.map(h => h.seat_id);
    const expiredHoldIds = expiredHolds.map(h => h.id);

    // Free the seats
    await Seat.update(
      { status: SEAT_STATUS.FREE },
      {
        where: { id: { [Op.in]: expiredSeatIds } },
        transaction: t,
      }
    );

    // Delete the hold rows
    await Hold.destroy({
      where: { id: { [Op.in]: expiredHoldIds } },
      transaction: t,
    });

    await t.commit();
    console.log(`[HoldExpiry] Freed ${expiredHolds.length} expired hold(s)`);
  } catch (error) {
    await t.rollback();
    console.error('[HoldExpiry] Error cleaning up expired holds:', error.message);
  }
};

const startExpiryWorker = () => {
  // Run every 30 seconds
  const intervalMs = EXPIRY_WORKER_INTERVAL_SECONDS * 1000;
  console.log(`[HoldExpiry] Worker started — checking every ${EXPIRY_WORKER_INTERVAL_SECONDS}s`);

  // Run immediately on startup
  cleanupExpiredHolds();

  // Then run periodically
  setInterval(cleanupExpiredHolds, intervalMs);
};

module.exports = { startExpiryWorker, cleanupExpiredHolds };
