const router = require('express').Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const ctrl = require('../controllers/adminController');

router.use(auth, admin);

router.get('/payments', ctrl.listPayments);
router.post('/payments/:requestId/approve', ctrl.approvePayment);
router.post('/payments/:requestId/reject', ctrl.rejectPayment);

module.exports = router;