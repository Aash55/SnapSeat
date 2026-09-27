const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const organizerController = require('../controllers/organizerController');

router.use(authMiddleware);
router.use(requireRole('organizer'));

router.post('/events', organizerController.createEvent);
router.get('/events', organizerController.getMyEvents);
router.get('/events/:id', organizerController.getMyEvent);
router.put('/events/:id', organizerController.updateEvent);
router.delete('/events/:id', organizerController.deleteEvent);
router.get('/dashboard', organizerController.getDashboard);
router.get('/analytics', organizerController.getAnalytics);

module.exports = router;
