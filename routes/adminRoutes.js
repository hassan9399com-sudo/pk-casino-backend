const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const LedgerEntry = require('../models/LedgerEntry');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

// ---------- User Management Routes ----------

// Get all users (Admin only)
router.get('/users', auth, admin, async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

// Update user status (block/unblock)
router.patch('/users/:id/status', auth, admin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'banned'].includes(status)) {
      throw ApiError.badRequest('Invalid status');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');

    if (!user) throw ApiError.notFound('User not found');

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// ---------- Financial & Deposit Management Routes ----------

// Get all pending deposits
router.get('/deposits/pending', auth, admin, async (req, res, next) => {
  try {
    const pendingDeposits = await Transaction.find({ type: 'deposit', status: 'pending' })
      .populate('userId', 'username phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pendingDeposits.length,
      data: pendingDeposits,
    });
  } catch (err) {
    next(err);
  }
});

// Approve user deposit
router.post('/deposits/approve', auth, admin, async (req, res, next) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      throw ApiError.badRequest('Transaction ID is required');
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) throw ApiError.notFound('Transaction not found');
    if (transaction.status !== 'pending') throw ApiError.badRequest('Transaction already processed');

    // 1. Transaction status update
    transaction.status = 'approved';
    await transaction.save();

    // 2. User wallet me balance credit karna
    if (ledgerService.creditUserWallet) {
      await ledgerService.creditUserWallet(transaction.userId, transaction.amount, 'deposit', transaction._id);
    }

    res.json({
      success: true,
      message: `Deposit of ${transaction.amount} PKR approved successfully.`,
      data: transaction,
    });
  } catch (err) {
    next(err);
  }
});

// Get system ledger logs
router.get('/ledger', auth, admin, async (req, res, next) => {
  try {
    const logs = await LedgerEntry.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
