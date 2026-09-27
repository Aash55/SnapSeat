const router = require('express').Router();
const authMiddleware = require('../middleware/auth');
const requireRole = require('../middleware/roleGuard');
const holdController = require('../controllers/holdController');

router.use(authMiddleware);
router.use(requireRole('attendee'));

router.post('/', holdController.createHold);
router.get('/active', holdController.getActiveHold);
router.get('/:holdGroupId', holdController.getHold);
router.delete('/:holdGroupId', holdController.releaseHold);

module.exports = router;
