const sequelize = require('../config/database');
const User = require('./User');
const Event = require('./Event');
const SeatCategory = require('./SeatCategory');
const Seat = require('./Seat');
const Hold = require('./Hold');
const Booking = require('./Booking');
const Payment = require('./Payment');
const WebhookEvent = require('./WebhookEvent');

// ── Users ──
User.hasMany(Event, { foreignKey: 'organizer_id', as: 'organizedEvents' });
User.hasMany(Hold, { foreignKey: 'user_id', as: 'holds' });
User.hasMany(Booking, { foreignKey: 'user_id', as: 'bookings' });

// ── Events ──
Event.belongsTo(User, { foreignKey: 'organizer_id', as: 'organizer' });
Event.hasMany(SeatCategory, { foreignKey: 'event_id', as: 'categories', onDelete: 'CASCADE', hooks: true });
Event.hasMany(Seat, { foreignKey: 'event_id', as: 'seats', onDelete: 'CASCADE', hooks: true });
Event.hasMany(Booking, { foreignKey: 'event_id', as: 'bookings' });

// ── Seat Categories ──
SeatCategory.belongsTo(Event, { foreignKey: 'event_id' });
SeatCategory.hasMany(Seat, { foreignKey: 'category_id', as: 'seats', onDelete: 'CASCADE', hooks: true });

// ── Seats ──
Seat.belongsTo(Event, { foreignKey: 'event_id' });
Seat.belongsTo(SeatCategory, { foreignKey: 'category_id', as: 'category' });
Seat.hasOne(Hold, { foreignKey: 'seat_id', as: 'hold' });

// ── Holds ──
Hold.belongsTo(Seat, { foreignKey: 'seat_id', as: 'seat' });
Hold.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// ── Bookings ──
Booking.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Booking.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
Booking.hasMany(Payment, { foreignKey: 'booking_id', as: 'payments' });
Booking.hasMany(Seat, { foreignKey: 'booking_id', as: 'bookedSeats' });
Seat.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });

// ── Payments ──
Payment.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
Payment.hasMany(WebhookEvent, { foreignKey: 'payment_id', as: 'webhookEvents' });

Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Payment.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// ── Webhook Events ──
WebhookEvent.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

module.exports = {
  sequelize,
  User,
  Event,
  SeatCategory,
  Seat,
  Hold,
  Booking,
  Payment,
  WebhookEvent,
};
