const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const User = require('../models/User');
const PaymentRequest = require('../models/PaymentRequest');
const LedgerEntry = require('../models/LedgerEntry');
const ApiError = require('../utils/ApiError');

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

// Get payment requests list
router.get('/payments', auth, admin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const requests = await PaymentRequest.find(filter).populate('userId', 'username phone');
    res.json({ success: true, data: requests });
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
