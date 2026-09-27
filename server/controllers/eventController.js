const { QueryTypes } = require('sequelize');
const { sequelize, Event } = require('../models');
const AppError = require('../utils/AppError');
const v = require('../utils/validate');
const { findActiveHold } = require('../services/bookingService');
const { HOLD_MAX_SEATS, HOLD_TTL_SECONDS } = require('../utils/constants');

// A seat counts as free if it's free, or if its hold has already run out (the sweeper may not
// have reached it yet). createHold reclaims such seats on the spot, so what we show is bookable.
const EFFECTIVE_STATUS = `CASE WHEN s.status = 'held' AND (h.expires_at IS NULL OR h.expires_at <= now()) THEN 'free' ELSE s.status::text END`;

exports.getAllEvents = async (req, res, next) => {
  try {
    const rows = await sequelize.query(
      `SELECT e.id, e.title, e.category, e.city, e.venue, e.date,
              COUNT(s.id) FILTER (WHERE ${EFFECTIVE_STATUS} = 'free')::int AS available_seats,
              COUNT(s.id)::int AS total_seats,
              MIN(c.price) AS min_price
         FROM events e
         LEFT JOIN seats s ON s.event_id = e.id
         LEFT JOIN holds h ON h.seat_id = s.id
         LEFT JOIN seat_categories c ON c.id = s.category_id
        WHERE e.date > now()
        GROUP BY e.id
        ORDER BY e.date ASC`,
      { type: QueryTypes.SELECT }
    );
    res.json(rows.map((r) => ({
      id: r.id, title: r.title, category: r.category, city: r.city, venue: r.venue, date: r.date,
      availableSeats: r.available_seats, totalSeats: r.total_seats, minPrice: r.min_price === null ? null : Number(r.min_price),
    })));
  } catch (err) {
    next(err);
  }
};

async function categoriesWithCounts(eventId) {
  const rows = await sequelize.query(
    `SELECT c.id, c.name, c.price,
            COUNT(s.id)::int AS total,
            COUNT(s.id) FILTER (WHERE ${EFFECTIVE_STATUS} = 'free')::int AS available
       FROM seat_categories c
       LEFT JOIN seats s ON s.category_id = c.id
       LEFT JOIN holds h ON h.seat_id = s.id
      WHERE c.event_id = :eventId
      GROUP BY c.id
      ORDER BY c.id`,
    { replacements: { eventId }, type: QueryTypes.SELECT }
  );
  return rows.map((c, index) => ({
    id: c.id, name: c.name, price: Number(c.price), index, totalSeats: c.total, availableSeats: c.available,
  }));
}

const eventDto = (e) => ({
  id: e.id, title: e.title, category: e.category, city: e.city, venue: e.venue, date: e.date,
  description: e.description, isPast: new Date(e.date).getTime() <= Date.now(),
});

exports.getEvent = async (req, res, next) => {
  try {
    const id = v.id(req.params.id, 'eventId');
    const event = await Event.findByPk(id);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
    res.json({ ...eventDto(event), categories: await categoriesWithCounts(id) });
  } catch (err) {
    next(err);
  }
};

exports.getSeatMap = async (req, res, next) => {
  try {
    const id = v.id(req.params.id, 'eventId');
    const event = await Event.findByPk(id);
    if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');

    const [categories, seats, active] = await Promise.all([
      categoriesWithCounts(id),
      sequelize.query(
        `SELECT s.id, s.seat_number, s.category_id, ${EFFECTIVE_STATUS} AS status,
                (h.user_id = :userId AND h.expires_at > now()) AS mine
           FROM seats s LEFT JOIN holds h ON h.seat_id = s.id
          WHERE s.event_id = :eventId
          ORDER BY s.category_id, s.id`,
        { replacements: { eventId: id, userId: req.user.id }, type: QueryTypes.SELECT }
      ),
      findActiveHold(req.user.id),
    ]);

    let myHold = null;
    if (active) {
      const other = active.event_id === id ? null : await Event.findByPk(active.event_id, { attributes: ['id', 'title'] });
      myHold = {
        holdGroupId: active.hold_group_id,
        eventId: active.event_id,
        eventTitle: other ? other.title : event.title,
        seatIds: active.seat_ids,
        expiresAt: active.expires_at,
        ttlSeconds: Math.max(0, Math.floor((new Date(active.expires_at).getTime() - Date.now()) / 1000)),
      };
    }

    res.json({
      event: eventDto(event),
      categories,
      seats: seats.map((s) => ({ id: s.id, seatNumber: s.seat_number, categoryId: s.category_id, status: s.status, mine: !!s.mine })),
      myHold,
      maxSeats: HOLD_MAX_SEATS,
      holdTtlSeconds: HOLD_TTL_SECONDS,
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
};
