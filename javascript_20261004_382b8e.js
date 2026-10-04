const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/walletController');

router.use(auth);

router.get('/balance', ctrl.getBalance);
router.get('/history', ctrl.getHistory);

module.exports = router;