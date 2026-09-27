const router = require('express').Router();
const webhookController = require('../controllers/webhookController');

router.post('/payment', webhookController.handlePaymentWebhook);

module.exports = router;
