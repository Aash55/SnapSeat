const router = require('express').Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const { isTest } = require('../config');

// 20 attempts per IP per minute across login/register (off in tests, which hammer these).
const limiter = isTest ? (req, res, next) => next() : rateLimit({ name: 'auth', windowMs: 60_000, max: 20 });

router.post('/register', limiter, authController.register);
router.post('/organizer/register', limiter, authController.organizerRegister);
router.post('/login', limiter, authController.login);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
