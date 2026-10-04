const router = require('express').Router();
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

router.use(auth);

router.post(
  '/deposit-request',
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount > 0'),
    body('paymentMethod').isIn(['easypaisa', 'jazzcash', 'bank', 'crypto']),
    body('trxId').isLength({ min: 4 }).withMessage('TRX ID required'),
    body('screenshotUrl').optional().isURL(),
  ],
  ctrl.createDeposit
);

router.post(
  '/withdraw-request',
  [
    body('amount').isFloat({ gt: 0 }),
    body('paymentMethod').isIn(['easypaisa', 'jazzcash', 'bank', 'crypto']),
    body('payoutDetails.accountNumber').notEmpty().withMessage('Account required'),
    body('payoutDetails.accountName').notEmpty().withMessage('Name required'),
  ],
  ctrl.createWithdrawal
);

router.get('/my-requests', ctrl.getMyRequests);

module.exports = router;