const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ledgerService = require('../services/ledgerService');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

// @route   GET /api/v1/wallet/balances
// @desc    Get current user balances
// @access  Private
router.get('/balances', auth, async (req, res, next) => {
  try {
    const balances = await ledgerService.getBalances(req.user._id);
    res.json({
      success: true,
      data: balances,
    });
  } catch (err) {
    next(err);
  }
});

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

module.exports = router;
