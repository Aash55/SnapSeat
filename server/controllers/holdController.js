const { sequelize, Hold, Seat, SeatCategory } = require('../models');
const AppError = require('../utils/AppError');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const { HOLD_TTL_MINUTES } = require('../utils/constants');

exports.createHold = async (req, res, next) => {
  try {
    const { eventId, seatIds } = req.body;

    if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0 || seatIds.length > 4) {
      return next(new AppError('eventId and seatIds array (1-4 items) are required', 400));
    }

    const uniqueSeatIds = [...new Set(seatIds)];
    if (uniqueSeatIds.length !== seatIds.length) {
      return next(new AppError('Duplicate seat IDs are not allowed', 400));
    }

    const activeHold = await Hold.findOne({
      where: {
        user_id: req.user.id,
        expires_at: { [Op.gt]: new Date() }
      }
    });

    if (activeHold) {
      return next(new AppError('User already has an active hold', 409, 'ACTIVE_HOLD_EXISTS'));
    }

    const t = await sequelize.transaction();
    try {
      const seats = await Seat.findAll({
        where: {
          id: { [Op.in]: uniqueSeatIds },
          event_id: eventId
        },
        include: [{ model: SeatCategory, as: 'category' }],
        // Postgres refuses `FOR UPDATE` across an outer join unless the lock is scoped to one
        // side of it (`FOR UPDATE OF "Seat"`) — without `of: Seat` this throws "FOR UPDATE cannot
        // be applied to the nullable side of an outer join" on every single hold attempt.
        lock: { level: t.LOCK.UPDATE, of: Seat },
        transaction: t
      });

      if (seats.length !== uniqueSeatIds.length) {
        await t.rollback();
        return next(new AppError('One or more seats not found for this event', 404));
      }

      for (const seat of seats) {
        if (seat.status !== 'free') {
          await t.rollback();
          return next(new AppError('One or more seats are not available', 409, 'SEAT_UNAVAILABLE'));
        }
      }

      const holdGroupId = uuidv4();
      const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

      const holdsData = seats.map(seat => ({
        hold_group_id: holdGroupId,
        user_id: req.user.id,
        event_id: eventId,
        seat_id: seat.id,
        expires_at: expiresAt
      }));

      await Hold.bulkCreate(holdsData, { transaction: t });

      await Seat.update(
        { status: 'held' },
        { where: { id: { [Op.in]: uniqueSeatIds } }, transaction: t }
      );

      await t.commit();

      let totalAmount = 0;
      const resultSeats = seats.map(seat => {
        totalAmount += Number(seat.category.price);
        return {
          id: seat.id,
          seatNumber: seat.seat_number,
          categoryName: seat.category.name,
          price: seat.category.price
        };
      });

      res.status(201).json({
        holdGroupId,
        seats: resultSeats,
        totalAmount,
        expiresAt,
        ttlSeconds: HOLD_TTL_MINUTES * 60
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

exports.getHold = async (req, res, next) => {
  try {
    const { holdGroupId } = req.params;

    const holds = await Hold.findAll({
      where: { hold_group_id: holdGroupId, user_id: req.user.id },
      include: [{
        model: Seat,
        as: 'seat',
        include: [{ model: SeatCategory, as: 'category' }]
      }]
    });

    if (!holds || holds.length === 0) {
      return next(new AppError('Hold not found', 404));
    }

    const firstHold = holds[0];
    const isExpired = new Date(firstHold.expires_at) < new Date();
    
    if (isExpired) {
      return res.status(200).json({ status: 'expired' });
    }

    const ttlSeconds = Math.max(0, Math.floor((new Date(firstHold.expires_at).getTime() - Date.now()) / 1000));
    
    const seats = holds.map(h => ({
      id: h.seat.id,
      seatNumber: h.seat.seat_number,
      categoryName: h.seat.category ? h.seat.category.name : null,
      price: h.seat.category ? h.seat.category.price : null
    }));

    res.status(200).json({
      holdGroupId,
      status: 'active',
      expiresAt: firstHold.expires_at,
      ttlSeconds,
      seats
    });
  } catch (error) {
    next(error);
  }
};

exports.releaseHold = async (req, res, next) => {
  try {
    const { holdGroupId } = req.params;

    const holds = await Hold.findAll({
      where: { hold_group_id: holdGroupId, user_id: req.user.id }
    });

    if (!holds || holds.length === 0) {
      return next(new AppError('Hold not found or not owned', 404));
    }

    const t = await sequelize.transaction();
    try {
      const seatIds = holds.map(h => h.seat_id);

      await Seat.update(
        { status: 'free' },
        { where: { id: { [Op.in]: seatIds } }, transaction: t }
      );

      await Hold.destroy({
        where: { hold_group_id: holdGroupId },
        transaction: t
      });

      await t.commit();
      res.status(200).json({ message: 'Hold released successfully' });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};
