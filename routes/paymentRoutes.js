const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const PaymentRequest = require('../models/PaymentRequest');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

// Player: Submit deposit or withdrawal request
router.post('/request', auth, async (req, res, next) => {
  try {
    const { type, amount, gateway, accountDetails } = req.body;

    if (!['deposit', 'withdrawal'].includes(type)) {
      throw ApiError.badRequest('Type must be deposit or withdrawal');
    }
    if (!amount || amount <= 0) {
      throw ApiError.badRequest('Invalid amount');
    }

    if (type === 'withdrawal') {
      await ledgerService.lockForWithdrawal(req.user._id, amount, 'PENDING_REQ');
    }

    const payReq = await PaymentRequest.create({
      userId: req.user._id,
      type,
      amount,
      gateway,
      accountDetails,
    });

    res.status(201).json({ success: true, data: payReq });
  } catch (err) {
    next(err);
  }
});

// Admin: Approve or reject payment request
router.patch('/:id/status', auth, admin, async (req, res, next) => {
  try {
    const { status, remarks } = req.body;
    const payReq = await PaymentRequest.findById(req.params.id);

    if (!payReq) throw ApiError.notFound('Payment request not found');
    if (payReq.status !== 'pending') {
      throw ApiError.badRequest('Request is already processed');
    }

    if (status === 'approved') {
      if (payReq.type === 'deposit') {
        await ledgerService.creditMain(payReq.userId, payReq.amount, 'DEPOSIT', payReq._id);
      } else if (payReq.type === 'withdrawal') {
        await ledgerService.approveWithdrawal(payReq.userId, payReq.amount, payReq._id);
      }
    } else if (status === 'rejected') {
      if (payReq.type === 'withdrawal') {
        await ledgerService.rejectWithdrawal(payReq.userId, payReq.amount, payReq._id);
      }
    } else {
      throw ApiError.badRequest('Invalid status');
    }

    payReq.status = status;
    payReq.remarks = remarks || '';
    await payReq.save();

    res.json({ success: true, data: payReq });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
