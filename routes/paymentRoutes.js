const express = require('express');
const router = express.Router();
const PaymentRequest = require('../models/PaymentRequest');
const Wallet = require('../models/Wallet');
const auth = require('../middleware/auth');

// @route   POST /api/payments/deposit
// @desc    Submit a new deposit request
// @access  Private
router.post('/deposit', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId, proofImage } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid deposit amount' });
    }

    if (!paymentMethod || !transactionId) {
      return res.status(400).json({ success: false, message: 'Payment method and Transaction ID are required' });
    }

    const paymentRequest = new PaymentRequest({
      userId: req.user._id || req.user.id,
      type: 'DEPOSIT',
      amount: Number(amount),
      paymentMethod,
      transactionId,
      proofImage: proofImage || null,
      status: 'PENDING',
    });

    await paymentRequest.save();

    res.status(201).json({
      success: true,
      message: 'Deposit request submitted successfully! Awaiting admin approval.',
      data: paymentRequest,
    });
  } catch (err) {
    console.error('Deposit Request Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error processing deposit request' });
  }
});

// @route   POST /api/payments/withdraw
// @desc    Submit a new withdrawal request
// @access  Private
router.post('/withdraw', auth, async (req, res) => {
  try {
    const { amount, paymentMethod, accountDetails } = req.body;
    const userId = req.user._id || req.user.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    if (!accountDetails) {
      return res.status(400).json({ success: false, message: 'Account details are required' });
    }

    // Check user's available wallet balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const paymentRequest = new PaymentRequest({
      userId,
      type: 'WITHDRAWAL',
      amount: Number(amount),
      paymentMethod,
      accountDetails,
      status: 'PENDING',
    });

    await paymentRequest.save();

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully! Awaiting admin processing.',
      data: paymentRequest,
    });
  } catch (err) {
    console.error('Withdrawal Request Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error processing withdrawal request' });
  }
});

// @route   GET /api/payments/my-requests
// @desc    Get user's payment requests history
// @access  Private
router.get('/my-requests', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const requests = await PaymentRequest.find({ userId }).sort({ createdAt: -1 });

    res.json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    console.error('Payment History Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error fetching payment requests' });
  }
});

module.exports = router;
