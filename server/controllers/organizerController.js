const { sequelize, Event, SeatCategory, Seat, Booking, Hold } = require('../models');
const AppError = require('../utils/AppError');
const { EVENT_CATEGORIES } = require('../utils/constants');
const { Op } = require('sequelize');

exports.createEvent = async (req, res, next) => {
  try {
    const { title, category, city, venue, date, seatCategories, description } = req.body;

    if (!title || !category || !city || !venue || !date || !seatCategories || !Array.isArray(seatCategories) || seatCategories.length === 0) {
      return next(new AppError('Missing required fields or seatCategories is empty', 400));
    }

    if (!EVENT_CATEGORIES.includes(category)) {
      return next(new AppError('Invalid category', 400));
    }

    if (new Date(date) <= new Date()) {
      return next(new AppError('Date must be in the future', 400));
    }

    for (const sc of seatCategories) {
      if (!sc.name || typeof sc.price !== 'number' || sc.price <= 0 || !Number.isInteger(sc.count) || sc.count <= 0) {
        return next(new AppError('Invalid seatCategory data', 400));
      }
    }

    const t = await sequelize.transaction();
    try {
      const event = await Event.create({
        title,
        category,
        city,
        venue,
        date,
        description,
        organizer_id: req.user.id
      }, { transaction: t });

      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let totalSeats = 0;
      
      for (let i = 0; i < seatCategories.length; i++) {
        const sc = seatCategories[i];
        const seatCategory = await SeatCategory.create({
          event_id: event.id,
          name: sc.name,
          price: sc.price
        }, { transaction: t });

        const rowLetter = letters[i % 26];
        const seats = [];
        for (let j = 1; j <= sc.count; j++) {
          seats.push({
            event_id: event.id,
            category_id: seatCategory.id,
            seat_number: `${rowLetter}${j}`,
            status: 'free'
          });
        }
        await Seat.bulkCreate(seats, { transaction: t });
        totalSeats += sc.count;
      }

      await t.commit();
      
      res.status(201).json({
        message: 'Event created successfully',
        event: {
          id: event.id,
          title: event.title,
          totalSeats
        }
      });
    } catch (error) {
      await t.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

exports.getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.findAll({
      where: { organizer_id: req.user.id }
    });

    const result = await Promise.all(events.map(async (event) => {
      const totalSeats = await Seat.count({ where: { event_id: event.id } });
      const bookedSeats = await Seat.count({ where: { event_id: event.id, status: 'booked' } });
      const heldSeats = await Seat.count({ where: { event_id: event.id, status: 'held' } });
      
      return {
        ...event.toJSON(),
        totalSeats,
        bookedSeats,
        heldSeats
      };
    }));

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getMyEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({
      where: { id: req.params.id, organizer_id: req.user.id },
      include: [
        { model: SeatCategory, as: 'categories' }
      ]
    });

    if (!event) {
      return next(new AppError('Event not found or not owned', 404));
    }

    const totalSeats = await Seat.count({ where: { event_id: event.id } });
    const bookedSeats = await Seat.count({ where: { event_id: event.id, status: 'booked' } });
    const heldSeats = await Seat.count({ where: { event_id: event.id, status: 'held' } });

    res.status(200).json({
      ...event.toJSON(),
      totalSeats,
      bookedSeats,
      heldSeats
    });
  } catch (error) {
    next(error);
  }
};

exports.updateEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ where: { id: req.params.id, organizer_id: req.user.id } });
    if (!event) {
      return next(new AppError('Event not found or not owned', 404));
    }

    const bookedSeatsCount = await Seat.count({ where: { event_id: event.id, status: 'booked' } });

    if (bookedSeatsCount > 0) {
      return next(new AppError('Cannot modify event with confirmed bookings', 409));
    }

    const { title, category, city, venue, date, description } = req.body;
    if (title) event.title = title;
    if (category) event.category = category;
    if (city) event.city = city;
    if (venue) event.venue = venue;
    if (date) event.date = date;
    if (description) event.description = description;

    await event.save();
    res.status(200).json(event);
  } catch (error) {
    next(error);
  }
};

exports.deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({ where: { id: req.params.id, organizer_id: req.user.id } });
    if (!event) {
      return next(new AppError('Event not found or not owned', 404));
    }

    const bookedSeatsCount = await Seat.count({ where: { event_id: event.id, status: 'booked' } });
    if (bookedSeatsCount > 0) {
      return next(new AppError('Cannot delete event with confirmed bookings', 409));
    }

    await event.destroy();
    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getDashboard = async (req, res, next) => {
  try {
    const events = await Event.findAll({ where: { organizer_id: req.user.id } });
    
    let totalEvents = events.length;
    let totalBookings = 0;
    let totalRevenue = 0;
    const breakdown = [];

    for (const event of events) {
      const seats = await Seat.findAll({ where: { event_id: event.id }, include: [{ model: SeatCategory, as: 'category' }] });
      const totalSeats = seats.length;
      const bookedSeats = seats.filter(s => s.status === 'booked').length;
      const heldSeats = seats.filter(s => s.status === 'held').length;
      const freeSeats = seats.filter(s => s.status === 'free').length;
      
      const revenue = seats.filter(s => s.status === 'booked').reduce((sum, s) => sum + Number(s.category.price), 0);
      
      totalBookings += bookedSeats;
      totalRevenue += revenue;
      
      breakdown.push({
        eventId: event.id,
        title: event.title,
        totalSeats,
        bookedSeats,
        heldSeats,
        freeSeats,
        revenue
      });
    }

    const eventIds = events.map(e => e.id);

    // Active holds right now, across all of this organizer's events (joined via Seat, since
    // Hold has no event_id column of its own — see MODEL_NOTES.md).
    let activeHolds = 0;
    let activeHoldEvents = 0;
    if (eventIds.length) {
      const activeHoldRows = await Hold.findAll({
        where: { expires_at: { [Op.gt]: new Date() } },
        include: [{ model: Seat, as: 'seat', where: { event_id: { [Op.in]: eventIds } }, attributes: ['event_id'] }]
      });
      activeHolds = activeHoldRows.length;
      activeHoldEvents = new Set(activeHoldRows.map(h => h.seat.event_id)).size;
    }

    // Latest confirmed bookings feed, newest first.
    let recentBookings = [];
    if (eventIds.length) {
      const bookings = await Booking.findAll({
        where: { event_id: { [Op.in]: eventIds }, status: 'CONFIRMED' },
        order: [['created_at', 'DESC']],
        limit: 8
      });
      const bookingIds = bookings.map(b => b.id);
      const seatCountByBooking = {};
      if (bookingIds.length) {
        const bookedSeats = await Seat.findAll({ where: { booking_id: { [Op.in]: bookingIds } }, attributes: ['booking_id'] });
        bookedSeats.forEach(s => {
          seatCountByBooking[s.booking_id] = (seatCountByBooking[s.booking_id] || 0) + 1;
        });
      }
      const titleByEventId = {};
      events.forEach(e => { titleByEventId[e.id] = e.title; });
      recentBookings = bookings.map(b => ({
        bookingId: b.id,
        eventTitle: titleByEventId[b.event_id],
        seats: seatCountByBooking[b.id] || 0,
        amount: Number(b.total_amount),
        createdAt: b.createdAt
      }));
    }

    res.status(200).json({
      totalEvents,
      totalBookings,
      totalRevenue,
      activeHolds,
      activeHoldEvents,
      breakdown,
      recentBookings
    });
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const { eventId } = req.query;
    const scope = !eventId || eventId === 'all' ? 'all' : 'single';

    const eventWhere = { organizer_id: req.user.id };
    if (scope === 'single') eventWhere.id = eventId;

    const events = await Event.findAll({
      where: eventWhere,
      include: [{ model: SeatCategory, as: 'categories' }]
    });

    if (scope === 'single' && events.length === 0) {
      return next(new AppError('Event not found or not owned', 404));
    }

    const eventIds = events.map(e => e.id);
    const titleByEventId = {};
    events.forEach(e => { titleByEventId[e.id] = e.title; });

    const seats = eventIds.length
      ? await Seat.findAll({ where: { event_id: { [Op.in]: eventIds } }, include: [{ model: SeatCategory, as: 'category' }] })
      : [];

    const bookings = eventIds.length
      ? await Booking.findAll({
          where: { event_id: { [Op.in]: eventIds }, status: 'CONFIRMED' },
          order: [['created_at', 'DESC']]
        })
      : [];

    const bookingIds = bookings.map(b => b.id);
    const bookedSeats = bookingIds.length
      ? await Seat.findAll({ where: { booking_id: { [Op.in]: bookingIds } }, include: [{ model: SeatCategory, as: 'category' }] })
      : [];

    const seatsByBooking = {};
    bookedSeats.forEach(s => {
      if (!seatsByBooking[s.booking_id]) seatsByBooking[s.booking_id] = [];
      seatsByBooking[s.booking_id].push(s);
    });

    const totalCapacity = seats.length;
    const totalSold = seats.filter(s => s.status === 'booked').length;
    const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);

    // Last 21 days, confirmed bookings bucketed by the day they were confirmed.
    const DAYS = 21;
    const dayKeys = [];
    const dayMap = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      dayMap[key] = { date: key, revenue: 0, seats: 0, bookings: 0 };
    }
    bookings.forEach(b => {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].revenue += Number(b.total_amount);
        dayMap[key].seats += (seatsByBooking[b.id] || []).length;
        dayMap[key].bookings += 1;
      }
    });
    const daily = dayKeys.map(k => dayMap[k]);

    // Occupancy: per event when viewing all events, per seat category when viewing one.
    let occupancy;
    if (scope === 'all') {
      occupancy = events.map(e => {
        const eventSeats = seats.filter(s => s.event_id === e.id);
        const cap = eventSeats.length;
        const sold = eventSeats.filter(s => s.status === 'booked').length;
        return { name: e.title, sold, cap, pct: cap ? Math.round((sold / cap) * 100) : 0 };
      });
    } else {
      const cats = events[0].categories || [];
      occupancy = cats.map(c => {
        const catSeats = seats.filter(s => s.category_id === c.id);
        const cap = catSeats.length;
        const sold = catSeats.filter(s => s.status === 'booked').length;
        return { name: c.name, sold, cap, pct: cap ? Math.round((sold / cap) * 100) : 0 };
      });
    }

    // Category revenue/seat mix across the scoped bookings.
    const catTotals = {};
    bookedSeats.forEach(s => {
      const name = s.category ? s.category.name : 'Unknown';
      if (!catTotals[name]) catTotals[name] = { name, seats: 0, revenue: 0 };
      catTotals[name].seats += 1;
      catTotals[name].revenue += Number(s.category ? s.category.price : 0);
    });
    const categoryMix = Object.values(catTotals);

    const rows = bookings.map(b => {
      const bSeats = seatsByBooking[b.id] || [];
      const categoryNames = [...new Set(bSeats.map(s => (s.category ? s.category.name : '')))].filter(Boolean);
      return {
        id: 'BK-' + String(b.id).padStart(6, '0'),
        eventName: titleByEventId[b.event_id],
        category: categoryNames.join(', '),
        seats: bSeats.length,
        amount: Number(b.total_amount),
        status: 'CONFIRMED',
        createdAt: b.createdAt
      };
    });

    res.status(200).json({
      scope,
      eventName: scope === 'single' ? events[0].title : null,
      stats: {
        revenue: totalRevenue,
        seatsSold: totalSold,
        totalCapacity,
        occupancyPct: totalCapacity ? Math.round((totalSold / totalCapacity) * 100) : 0,
        totalBookings: bookings.length
      },
      daily,
      occupancy,
      categoryMix,
      bookings: rows
    });
  } catch (error) {
    next(error);
  }
};
