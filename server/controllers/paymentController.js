const { Payment, Hold, Seat, SeatCategory, Booking } = require('../models');
const AppError = require('../utils/AppError');
const { processWebhookPayment } = require('./webhookController');
const { v4: uuidv4 } = require('uuid');

const fakeGateway = {
  processPayment: async (amount, simulateFailure) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (simulateFailure) {
          resolve({ success: false });
        } else {
          resolve({
            success: true,
            gateway_event_id: uuidv4(),
            gateway_payment_id: `pay_${uuidv4()}`
          });
        }
      }, 500);
    });
  }
};

exports.initiatePayment = async (req, res, next) => {
  try {
    const { holdGroupId, idempotencyKey, simulateFailure = false } = req.body;

    if (!holdGroupId || !idempotencyKey) {
      return next(new AppError('holdGroupId and idempotencyKey are required', 400));
    }

    const existingPayment = await Payment.findOne({ where: { idempotency_key: idempotencyKey } });
    if (existingPayment) {
      return res.status(200).json({
        paymentId: existingPayment.id,
        status: existingPayment.status,
        amount: existingPayment.amount,
        bookingId: existingPayment.booking_id,
        message: 'Idempotent response'
      });
    }

    const holds = await Hold.findAll({
      where: { hold_group_id: holdGroupId, user_id: req.user.id },
      include: [{
        model: Seat,
        as: 'seat',
        include: [{ model: SeatCategory, as: 'category' }]
      }]
    });

    if (!holds || holds.length === 0) {
      return next(new AppError('Hold not found or not owned', 404));
    }

    if (new Date(holds[0].expires_at) < new Date()) {
      return next(new AppError('Hold has expired', 410, 'HOLD_EXPIRED'));
    }

    let amount = 0;
    for (const hold of holds) {
      amount += Number(hold.seat.category.price);
    }

    const payment = await Payment.create({
      status: 'PENDING',
      hold_group_id: holdGroupId,
      idempotency_key: idempotencyKey,
      amount
    });

    const result = await fakeGateway.processPayment(amount, simulateFailure);

    if (!result.success) {
      payment.status = 'FAILED';
      await payment.save();
      return res.status(200).json({
        paymentId: payment.id,
        status: 'FAILED',
        message: 'Payment declined'
      });
    }

    payment.gateway_payment_id = result.gateway_payment_id;
    await payment.save();

    const webhookResult = await processWebhookPayment({
      gatewayEventId: result.gateway_event_id,
      gatewayPaymentId: result.gateway_payment_id,
      status: 'SUCCESS'
    });

    await payment.reload();

    res.status(200).json({
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      bookingId: payment.booking_id,
      bookingStatus: webhookResult.bookingStatus || null,
      message: 'Payment processed'
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findByPk(req.params.id, {
      include: [{ model: Booking, as: 'booking' }]
    });

    if (!payment) {
      return next(new AppError('Payment not found', 404));
    }

    const holds = await Hold.findAll({ where: { hold_group_id: payment.hold_group_id } });
    let isOwner = false;

    if (holds.length > 0 && holds[0].user_id === req.user.id) {
      isOwner = true;
    } else if (payment.booking && payment.booking.user_id === req.user.id) {
      isOwner = true;
    }

    if (!isOwner) {
      return next(new AppError('Payment not found or not owned', 404));
    }

    res.status(200).json(payment);
  } catch (error) {
    next(error);
  }
};
