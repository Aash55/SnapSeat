const { Event, SeatCategory, Seat } = require('../models');
const AppError = require('../utils/AppError');

exports.getAllEvents = async (req, res, next) => {
  try {
    const events = await Event.findAll();
    
    const result = await Promise.all(events.map(async (event) => {
      const availableSeats = await Seat.count({ where: { event_id: event.id, status: 'free' } });
      return {
        id: event.id,
        title: event.title,
        category: event.category,
        city: event.city,
        venue: event.venue,
        date: event.date,
        availableSeats
      };
    }));

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getEvent = async (req, res, next) => {
  try {
    const event = await Event.findOne({
      where: { id: req.params.id },
      include: [{ model: SeatCategory, as: 'categories' }]
    });

    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    const categoriesWithCounts = await Promise.all(event.categories.map(async (cat) => {
      const availableSeats = await Seat.count({ where: { category_id: cat.id, status: 'free' } });
      return {
        ...cat.toJSON(),
        availableSeats
      };
    }));

    res.status(200).json({
      ...event.toJSON(),
      categories: categoriesWithCounts
    });
  } catch (error) {
    next(error);
  }
};

exports.getSeatMap = async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) {
      return next(new AppError('Event not found', 404));
    }

    const seats = await Seat.findAll({
      where: { event_id: event.id },
      include: [{ model: SeatCategory, as: 'category' }]
    });

    const resultSeats = seats.map(seat => ({
      id: seat.id,
      seatNumber: seat.seat_number,
      categoryName: seat.category ? seat.category.name : null,
      price: seat.category ? seat.category.price : null,
      status: seat.status
    }));

    res.status(200).json({
      eventId: event.id,
      seats: resultSeats
    });
  } catch (error) {
    next(error);
  }
};
