const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const paymentController = require('../controllers/paymentController');

router.use(authMiddleware);
router.use(requireRole('attendee'));

router.post('/', paymentController.initiatePayment);
router.get('/:id', paymentController.getPayment);

module.exports = router;
