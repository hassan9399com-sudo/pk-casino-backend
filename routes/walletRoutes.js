const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ledgerService = require('../services/ledgerService');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

// @route   GET /api/v1/wallet/balances
// @route   GET /api/v1/wallet/balance (Alias to prevent 404)
// @desc    Get current user balances
// @access  Private
const getBalancesHandler = async (req, res, next) => {
  try {
    const balances = await ledgerService.getBalances(req.user._id);
    res.json({
      success: true,
      data: balances,
    });
  } catch (err) {
    next(err);
  }
};

router.get('/balances', auth, getBalancesHandler);
router.get('/balance', auth, getBalancesHandler);

// @route   POST /api/v1/wallet/deposit
// @desc    User deposit request submit karega
// @access  Private
router.post('/deposit', auth, async (req, res, next) => {
  try {
    const { amount, paymentMethod, accountNumber, trxId } = req.body;

    if (!amount || !paymentMethod || !accountNumber || !trxId) {
      throw ApiError.badRequest('Amount, payment method, account number, and transaction ID are required');
    }

    if (amount < 100) {
      throw ApiError.badRequest('Minimum deposit amount is 100 PKR');
    }

    // Pending deposit request save karein
    const depositRequest = await Transaction.create({
      userId: req.user._id,
      type: 'deposit',
      amount,
      paymentMethod,
      accountNumber,
      trxId,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully. Pending admin approval.',
      data: depositRequest,
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/v1/wallet/withdraw
// @desc    User withdrawal request submit karega
// @access  Private
router.post('/withdraw', auth, async (req, res, next) => {
  try {
    const { amount, paymentMethod, accountNumber } = req.body;

    if (!amount || !paymentMethod || !accountNumber) {
      throw ApiError.badRequest('Amount, payment method, and account number are required');
    }

    if (amount < 500) {
      throw ApiError.badRequest('Minimum withdrawal amount is 500 PKR');
    }

    // Check user balance before allowing withdrawal request
    const userBalances = await ledgerService.getBalances(req.user._id);
    const availableBalance = userBalances.totalBalance || userBalances.cashBalance || 0;

    if (availableBalance < amount) {
      throw ApiError.badRequest('Insufficient balance for withdrawal');
    }

    // Pending withdrawal request save karein
    const withdrawRequest = await Transaction.create({
      userId: req.user._id,
      type: 'withdraw',
      amount,
      paymentMethod,
      accountNumber,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Pending admin approval.',
      data: withdrawRequest,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
