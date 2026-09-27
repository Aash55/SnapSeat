const router = require('express').Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/organizer/register', authController.organizerRegister);
router.post('/login', authController.login);

module.exports = router;
