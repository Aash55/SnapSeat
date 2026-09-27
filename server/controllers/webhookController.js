const { sequelize, Payment, Hold, Seat, Booking, WebhookEvent } = require('../models');
const { Op } = require('sequelize');

const processWebhookPayment = async (payload) => {
  const { gatewayEventId, gatewayPaymentId, status } = payload;
  
  const t = await sequelize.transaction();
  try {
    // WebhookEvent.payment_id is NOT NULL, so we need the payment's row id before we can log
    // the event at all. This lookup is unlocked — the row gets locked below, right before we
    // act on it.
    const paymentLookup = await Payment.findOne({
      where: { gateway_payment_id: gatewayPaymentId },
      transaction: t
    });

    if (!paymentLookup) {
      await t.rollback();
      return { error: 'Payment not found' };
    }

    try {
      await WebhookEvent.create({
        gateway_event_id: gatewayEventId,
        payment_id: paymentLookup.id,
        payload: payload,
        processed_at: new Date()
      }, { transaction: t });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        await t.commit();
        return { alreadyProcessed: true };
      }
      throw error;
    }

    const payment = await Payment.findOne({
      where: { id: paymentLookup.id },
      lock: t.LOCK.UPDATE,
      transaction: t
    });

    if (!payment) {
      await t.rollback();
      return { error: 'Payment not found' };
    }

    const holds = await Hold.findAll({
      where: { hold_group_id: payment.hold_group_id },
      lock: t.LOCK.UPDATE,
      transaction: t
    });

    const seatIds = holds.map(h => h.seat_id);
    let seats = [];
    if (seatIds.length > 0) {
      seats = await Seat.findAll({
        where: { id: { [Op.in]: seatIds } },
        lock: t.LOCK.UPDATE,
        transaction: t
      });
    }

    const allHeld = seats.length > 0 && seats.every(s => s.status === 'held');

    if (holds.length > 0 && allHeld && status === 'SUCCESS') {
      const booking = await Booking.create({
        status: 'CONFIRMED',
        total_amount: payment.amount,
        user_id: holds[0].user_id,
        // Hold has no event_id column of its own (only seat_id) — read it off the seat instead.
        event_id: seats[0].event_id,
        hold_group_id: payment.hold_group_id
      }, { transaction: t });

      await Seat.update(
        { status: 'booked', booking_id: booking.id },
        { where: { id: { [Op.in]: seatIds } }, transaction: t }
      );

      await Hold.destroy({
        where: { hold_group_id: payment.hold_group_id },
        transaction: t
      });

      payment.status = 'SUCCESS';
      payment.booking_id = booking.id;
      await payment.save({ transaction: t });

      await t.commit();
      return { success: true, bookingId: booking.id, bookingStatus: 'CONFIRMED' };
    } else {
      payment.status = 'REFUND_PENDING';
      await payment.save({ transaction: t });
      
      await t.commit();
      return { success: true, bookingStatus: 'REFUND_PENDING' };
    }
  } catch (error) {
    await t.rollback();
    throw error;
  }
};

exports.processWebhookPayment = processWebhookPayment;

exports.handlePaymentWebhook = async (req, res, next) => {
  try {
    const { gatewayEventId, gatewayPaymentId, status } = req.body;
    
    if (gatewayEventId && gatewayPaymentId) {
      await processWebhookPayment({ gatewayEventId, gatewayPaymentId, status });
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(200).json({ received: true });
  }
};
