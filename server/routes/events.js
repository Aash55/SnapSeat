const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const eventController = require('../controllers/eventController');

// Public routes (no auth for browsing)
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEvent);

// Protected route (need to be logged in to see seat map)
router.get('/:id/seats', authMiddleware, eventController.getSeatMap);

module.exports = router;
