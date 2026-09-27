const booking = require('../services/bookingService');
const v = require('../utils/validate');
const AppError = require('../utils/AppError');
const { HOLD_MAX_SEATS, HOLD_TTL_SECONDS } = require('../utils/constants');
const { Event } = require('../models');

exports.createHold = async (req, res, next) => {
  try {
    const eventId = v.id(req.body?.eventId, 'eventId');
    const raw = req.body?.seatIds;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > HOLD_MAX_SEATS) {
      throw new AppError(`Pick between 1 and ${HOLD_MAX_SEATS} seats`, 400, 'VALIDATION_ERROR', { field: 'seatIds' });
    }
    const seatIds = raw.map((s) => v.id(s, 'seatIds'));
    if (new Set(seatIds).size !== seatIds.length) throw v.bad('Duplicate seats in the request', 'seatIds');
    seatIds.sort((a, b) => a - b);

    const hold = await booking.createHold({ userId: req.user.id, eventId, seatIds });
    res.status(201).json(hold);
  } catch (err) {
    next(err);
  }
};

exports.getActiveHold = async (req, res, next) => {
  try {
    const active = await booking.findActiveHold(req.user.id);
    if (!active) return res.json({ hold: null });
    const event = await Event.findByPk(active.event_id);
    const ttlSeconds = Math.max(0, Math.floor((new Date(active.expires_at).getTime() - Date.now()) / 1000));
    res.json({
      hold: {
        holdGroupId: active.hold_group_id,
        eventId: active.event_id,
        eventTitle: event?.title,
        seatIds: active.seat_ids,
        expiresAt: active.expires_at,
        ttlSeconds,
        holdTtlSeconds: HOLD_TTL_SECONDS,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getHold = async (req, res, next) => {
  try {
    const holdGroupId = v.uuid(req.params.holdGroupId, 'holdGroupId');
    res.json(await booking.getHold({ userId: req.user.id, holdGroupId }));
  } catch (err) {
    next(err);
  }
};

exports.releaseHold = async (req, res, next) => {
  try {
    const holdGroupId = v.uuid(req.params.holdGroupId, 'holdGroupId');
    const result = await booking.releaseHold({ userId: req.user.id, holdGroupId });
    res.json({ message: 'Seats released', ...result });
  } catch (err) {
    next(err);
  }
};
