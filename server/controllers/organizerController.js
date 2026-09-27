const { QueryTypes } = require('sequelize');
const { sequelize, Event, SeatCategory, Seat } = require('../models');
const AppError = require('../utils/AppError');
const v = require('../utils/validate');
const { bookingCode } = require('../services/bookingService');
const {
  EVENT_CATEGORIES, MAX_SEAT_CATEGORIES, MAX_SEATS_PER_CATEGORY, MAX_SEATS_PER_EVENT, MAX_PRICE,
} = require('../utils/constants');

const APP_TZ = 'Asia/Kolkata';
const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Held seats whose hold already ran out count as free (same rule as the public seat map).
const SEAT_COUNTS_SQL = `
  SELECT s.event_id,
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE s.status = 'booked')::int AS booked,
         COUNT(*) FILTER (WHERE s.status = 'held' AND h.expires_at > now())::int AS held
    FROM seats s LEFT JOIN holds h ON h.seat_id = s.id
   WHERE s.event_id IN (:eventIds)
   GROUP BY s.event_id`;

async function seatCountsByEvent(eventIds) {
  if (!eventIds.length) return {};
  const rows = await sequelize.query(SEAT_COUNTS_SQL, { replacements: { eventIds }, type: QueryTypes.SELECT });
  const map = {};
  rows.forEach((r) => { map[r.event_id] = { totalSeats: r.total, bookedSeats: r.booked, heldSeats: r.held }; });
  return map;
}

const withCounts = (event, counts) => ({
  ...event.toJSON(),
  ...(counts[event.id] || { totalSeats: 0, bookedSeats: 0, heldSeats: 0 }),
});

function readSeatCategories(list) {
  if (!Array.isArray(list) || list.length === 0) throw v.bad('Add at least one seat category', 'seatCategories');
  if (list.length > MAX_SEAT_CATEGORIES) throw v.bad(`At most ${MAX_SEAT_CATEGORIES} seat categories per event`, 'seatCategories');
  const seen = new Set();
  let total = 0;
  const cats = list.map((sc, i) => {
    const name = v.string(sc?.name, `seatCategories[${i}].name`, { max: 40 });
    const key = name.toLowerCase();
    if (seen.has(key)) throw v.bad(`Category name "${name}" is used twice`, 'seatCategories');
    seen.add(key);
    const price = Number(sc?.price);
    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE || Math.round(price * 100) !== price * 100) {
      throw v.bad(`Price for ${name} must be between ₹0.01 and ₹${MAX_PRICE.toLocaleString('en-IN')}`, 'seatCategories');
    }
    const count = Number(sc?.count);
    if (!Number.isInteger(count) || count < 1 || count > MAX_SEATS_PER_CATEGORY) {
      throw v.bad(`Seats for ${name} must be between 1 and ${MAX_SEATS_PER_CATEGORY}`, 'seatCategories');
    }
    total += count;
    return { name, price, count };
  });
  if (total > MAX_SEATS_PER_EVENT) throw v.bad(`An event can have at most ${MAX_SEATS_PER_EVENT.toLocaleString('en-IN')} seats`, 'seatCategories');
  return { cats, total };
}

function readEventFields(body, { partial }) {
  const out = {};
  const has = (k) => body[k] !== undefined;
  if (!partial || has('title')) out.title = v.string(body.title, 'title', { max: 120 });
  if (!partial || has('category')) out.category = v.oneOf(body.category, EVENT_CATEGORIES, 'category');
  if (!partial || has('city')) out.city = v.string(body.city, 'city', { max: 80 });
  if (!partial || has('venue')) out.venue = v.string(body.venue, 'venue', { max: 120 });
  if (!partial || has('date')) out.date = v.futureDate(body.date, 'date');
  if (has('description')) out.description = v.string(body.description, 'description', { max: 1000, optional: true });
  return out;
}

async function findOwnedEvent(req, options = {}) {
  const id = v.id(req.params.id, 'eventId');
  const event = await Event.findOne({ where: { id, organizer_id: req.user.id }, ...options });
  if (!event) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  return event;
}

exports.createEvent = async (req, res, next) => {
  try {
    const body = req.body || {};
    const fields = readEventFields(body, { partial: false });
    const { cats, total } = readSeatCategories(body.seatCategories);

    const event = await sequelize.transaction(async (transaction) => {
      const ev = await Event.create({ ...fields, organizer_id: req.user.id }, { transaction });
      const seats = [];
      for (let i = 0; i < cats.length; i++) {
        const cat = await SeatCategory.create({ event_id: ev.id, name: cats[i].name, price: cats[i].price }, { transaction });
        const letter = ROW_LETTERS[i];
        for (let n = 1; n <= cats[i].count; n++) {
          seats.push({ event_id: ev.id, category_id: cat.id, seat_number: `${letter}${n}`, status: 'free' });
        }
      }
      await Seat.bulkCreate(seats, { transaction, validate: false, returning: false });
      return ev;
    });

    res.status(201).json({ message: 'Event created', event: { id: event.id, title: event.title, totalSeats: total } });
  } catch (err) {
    next(err);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.findAll({ where: { organizer_id: req.user.id }, order: [['date', 'ASC']] });
    const counts = await seatCountsByEvent(events.map((e) => e.id));
    res.json(events.map((e) => withCounts(e, counts)));
  } catch (err) {
    next(err);
  }
};

exports.getMyEvent = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req, { include: [{ model: SeatCategory, as: 'categories' }], order: [[{ model: SeatCategory, as: 'categories' }, 'id', 'ASC']] });
    const counts = await seatCountsByEvent([event.id]);
    res.json(withCounts(event, counts));
  } catch (err) {
    next(err);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req);
    const counts = await seatCountsByEvent([event.id]);
    if (counts[event.id]?.bookedSeats > 0) {
      throw new AppError('This event already has confirmed bookings, so its details are locked.', 409, 'EVENT_HAS_BOOKINGS');
    }
    const fields = readEventFields(req.body || {}, { partial: true });
    if (!Object.keys(fields).length) throw v.bad('Nothing to update');
    await event.update(fields);
    res.json(withCounts(event, counts));
  } catch (err) {
    next(err);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req);
    await sequelize.transaction(async (transaction) => {
      // Lock the event's seats so no hold or booking can slip in between the check and the delete.
      const [state] = await sequelize.query(
        `SELECT COUNT(*) FILTER (WHERE s.status = 'booked')::int AS booked,
                COUNT(*) FILTER (WHERE s.status = 'held')::int AS held
           FROM (SELECT id, status FROM seats WHERE event_id = :id FOR UPDATE) s`,
        { replacements: { id: event.id }, type: QueryTypes.SELECT, transaction }
      );
      if (state.booked > 0) throw new AppError('Events with confirmed bookings can’t be deleted.', 409, 'EVENT_HAS_BOOKINGS');
      if (state.held > 0) throw new AppError('Customers are checking out for this event right now. Try again in a few minutes.', 409, 'EVENT_HAS_HOLDS');
      await event.destroy({ transaction });
    });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const organizerId = req.user.id;
    const events = await Event.findAll({ where: { organizer_id: organizerId }, attributes: ['id', 'title', 'date'] });
    const eventIds = events.map((e) => e.id);
    const counts = await seatCountsByEvent(eventIds);

    let totals = { revenue: 0, bookings: 0 };
    let activeHolds = 0;
    let activeHoldEvents = 0;
    let recentBookings = [];

    if (eventIds.length) {
      const [t] = await sequelize.query(
        `SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*)::int AS bookings
           FROM bookings WHERE event_id IN (:eventIds) AND status = 'CONFIRMED'`,
        { replacements: { eventIds }, type: QueryTypes.SELECT }
      );
      totals = { revenue: Number(t.revenue), bookings: t.bookings };

      const [h] = await sequelize.query(
        `SELECT COUNT(*)::int AS seats, COUNT(DISTINCT s.event_id)::int AS events
           FROM holds h JOIN seats s ON s.id = h.seat_id
          WHERE s.event_id IN (:eventIds) AND h.expires_at > now()`,
        { replacements: { eventIds }, type: QueryTypes.SELECT }
      );
      activeHolds = h.seats;
      activeHoldEvents = h.events;

      const rows = await sequelize.query(
        `SELECT b.id, b.event_id, b.total_amount, b.created_at, e.title,
                (SELECT COUNT(*) FROM seats s WHERE s.booking_id = b.id)::int AS seats
           FROM bookings b JOIN events e ON e.id = b.event_id
          WHERE b.event_id IN (:eventIds) AND b.status = 'CONFIRMED'
          ORDER BY b.created_at DESC LIMIT 8`,
        { replacements: { eventIds }, type: QueryTypes.SELECT }
      );
      recentBookings = rows.map((b) => ({
        bookingId: b.id, bookingCode: bookingCode(b.id), eventTitle: b.title, seats: b.seats,
        amount: Number(b.total_amount), createdAt: b.created_at,
      }));
    }

    const seatTotals = Object.values(counts).reduce((a, c) => ({ booked: a.booked + c.bookedSeats }), { booked: 0 });

    res.json({
      totalEvents: events.length,
      totalBookings: seatTotals.booked, // seats sold (the KPI card's label says "confirmed seats booked")
      bookingCount: totals.bookings,
      totalRevenue: totals.revenue,
      activeHolds,
      activeHoldEvents,
      breakdown: events.map((e) => ({ eventId: e.id, title: e.title, ...(counts[e.id] || {}) })),
      recentBookings,
    });
  } catch (err) {
    next(err);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const raw = req.query.eventId;
    const scope = !raw || raw === 'all' ? 'all' : 'single';
    const eventWhere = { organizer_id: req.user.id };
    if (scope === 'single') eventWhere.id = v.id(raw, 'eventId');

    const events = await Event.findAll({
      where: eventWhere,
      include: [{ model: SeatCategory, as: 'categories' }],
      order: [['date', 'ASC'], [{ model: SeatCategory, as: 'categories' }, 'id', 'ASC']],
    });
    if (scope === 'single' && !events.length) throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');

    const eventIds = events.map((e) => e.id);
    const titleById = Object.fromEntries(events.map((e) => [e.id, e.title]));
    const empty = { revenue: 0, seatsSold: 0, totalCapacity: 0, occupancyPct: 0, totalBookings: 0 };
    if (!eventIds.length) {
      return res.json({ scope, eventName: null, stats: empty, daily: [], occupancy: [], categoryMix: [], bookings: [] });
    }

    const perCategory = await sequelize.query(
      `SELECT s.event_id, s.category_id, COUNT(*)::int AS cap,
              COUNT(*) FILTER (WHERE s.status = 'booked')::int AS sold
         FROM seats s WHERE s.event_id IN (:eventIds)
        GROUP BY s.event_id, s.category_id`,
      { replacements: { eventIds }, type: QueryTypes.SELECT }
    );
    const bookings = await sequelize.query(
      `SELECT b.id, b.event_id, b.total_amount, b.created_at,
              to_char(b.created_at AT TIME ZONE '${APP_TZ}', 'YYYY-MM-DD') AS day,
              COUNT(s.id)::int AS seats,
              COALESCE(STRING_AGG(DISTINCT c.name, ', '), '') AS categories
         FROM bookings b
         LEFT JOIN seats s ON s.booking_id = b.id
         LEFT JOIN seat_categories c ON c.id = s.category_id
        WHERE b.event_id IN (:eventIds) AND b.status = 'CONFIRMED'
        GROUP BY b.id
        ORDER BY b.created_at DESC`,
      { replacements: { eventIds }, type: QueryTypes.SELECT }
    );
    const mix = await sequelize.query(
      `SELECT c.name, COUNT(*)::int AS seats, SUM(c.price) AS revenue
         FROM seats s JOIN seat_categories c ON c.id = s.category_id
        WHERE s.event_id IN (:eventIds) AND s.status = 'booked'
        GROUP BY c.name ORDER BY MIN(c.id)`,
      { replacements: { eventIds }, type: QueryTypes.SELECT }
    );

    const totalCapacity = perCategory.reduce((a, r) => a + r.cap, 0);
    const totalSold = perCategory.reduce((a, r) => a + r.sold, 0);
    const totalRevenue = bookings.reduce((a, b) => a + Number(b.total_amount), 0);

    // Last 21 days in India time, oldest first.
    const DAYS = 21;
    const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayMap = {};
    const daily = [];
    for (let i = DAYS - 1; i >= 0; i--) {
      const key = fmtDay.format(new Date(Date.now() - i * 86400000));
      dayMap[key] = { date: key, revenue: 0, seats: 0, bookings: 0 };
      daily.push(dayMap[key]);
    }
    bookings.forEach((b) => {
      const d = dayMap[b.day];
      if (d) { d.revenue += Number(b.total_amount); d.seats += b.seats; d.bookings += 1; }
    });

    const pct = (sold, cap) => (cap ? Math.round((sold / cap) * 100) : 0);
    let occupancy;
    if (scope === 'all') {
      occupancy = events.map((e) => {
        const rows = perCategory.filter((r) => r.event_id === e.id);
        const cap = rows.reduce((a, r) => a + r.cap, 0);
        const sold = rows.reduce((a, r) => a + r.sold, 0);
        return { name: e.title, sold, cap, pct: pct(sold, cap) };
      });
    } else {
      occupancy = events[0].categories.map((c) => {
        const r = perCategory.find((x) => x.category_id === c.id) || { cap: 0, sold: 0 };
        return { name: c.name, sold: r.sold, cap: r.cap, pct: pct(r.sold, r.cap) };
      });
    }

    res.json({
      scope,
      eventName: scope === 'single' ? events[0].title : null,
      stats: {
        revenue: totalRevenue,
        seatsSold: totalSold,
        totalCapacity,
        occupancyPct: pct(totalSold, totalCapacity),
        totalBookings: bookings.length,
      },
      daily,
      occupancy,
      categoryMix: mix.map((m) => ({ name: m.name, seats: m.seats, revenue: Number(m.revenue) })),
      bookings: bookings.map((b) => ({
        id: bookingCode(b.id),
        eventName: titleById[b.event_id],
        category: b.categories,
        seats: b.seats,
        amount: Number(b.total_amount),
        status: 'CONFIRMED',
        createdAt: b.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
};
