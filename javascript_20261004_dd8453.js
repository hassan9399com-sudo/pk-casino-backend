const router = require('express').Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const auth = require('../middleware/auth');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

router.post(
  '/register',
  authLimiter,
  [
    body('phone').matches(/^\+?[0-9]{10,15}$/).withMessage('Invalid phone'),
    body('password').isLength({ min: 6 }).withMessage('Password 6+ chars'),
    body('name').optional().isLength({ max: 50 }),
  ],
  ctrl.register
);

router.post(
  '/login',
  authLimiter,
  [
    body('phone').notEmpty(),
    body('password').notEmpty(),
  ],
  ctrl.login
);

router.get('/me', auth, ctrl.me);

module.exports = router;