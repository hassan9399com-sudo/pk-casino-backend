const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const PaymentRequest = require('../models/PaymentRequest');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

const MIN_WITHDRAWAL = parseFloat(process.env.MIN_WITHDRAWAL || 500);

/** POST /api/v1/payments/deposit-request */
exports.createDeposit = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Validation failed', errors.array());

    const { amount, paymentMethod, trxId, screenshotUrl } = req.body;

    // Prevent duplicate trxId
    const dupe = await PaymentRequest.findOne({ trxId, type: 'deposit' });
    if (dupe) throw ApiError.conflict('This TRX ID has already been used');

    const request = await PaymentRequest.create({
      requestId: uuidv4(),
      userId: req.user._id,
      type: 'deposit',
      amount,
      paymentMethod,
      trxId,
      screenshotUrl,
      status: 'pending',
    });

    // Notify admin channel
    const io = req.app.get('io');
    if (io) io.to('admins').emit('payment:new-deposit', {
      requestId: request.requestId,
      amount,
      paymentMethod,
      trxId,
      userId: req.user._id,
    });

    res.status(201).json({ success: true, request });
  } catch (err) { next(err); }
};

/** POST /api/v1/payments/withdraw-request */
exports.createWithdrawal = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Validation failed', errors.array());

    const { amount, paymentMethod, payoutDetails } = req.body;

    if (amount < MIN_WITHDRAWAL)
      throw ApiError.badRequest(`Minimum withdrawal is ${MIN_WITHDRAWAL}`);

    const balances = await ledgerService.getBalances(req.user._id);
    if (balances.mainCredits < amount)
      throw ApiError.badRequest('Insufficient main credits');

    // 1. Create request
    const request = await PaymentRequest.create({
      requestId: uuidv4(),
      userId: req.user._id,
      type: 'withdrawal',
      amount,
      paymentMethod,
      payoutDetails,
      status: 'pending',
    });

    // 2. Lock funds (USER_MAIN → USER_LOCKED)
    try {
      await ledgerService.lockForWithdrawal(
        req.user._id,
        amount,
        request.requestId
      );
    } catch (err) {
      // Rollback the request if lock failed
      await PaymentRequest.deleteOne({ _id: request._id });
      throw err;
    }

    // 3. Emit wallet update + admin notification
    const io = req.app.get('io');
    if (io) {
      const updatedBalances = await ledgerService.getBalances(req.user._id);
      io.to(`user:${req.user._id}`).emit('wallet_update', updatedBalances);
      io.to('admins').emit('payment:new-withdrawal', {
        requestId: request.requestId,
        amount,
        paymentMethod,
        userId: req.user._id,
      });
    }

    res.status(201).json({ success: true, request });
  } catch (err) { next(err); }
};

/** GET /api/v1/payments/my-requests */
exports.getMyRequests = async (req, res, next) => {
  try {
    const requests = await PaymentRequest.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, requests });
  } catch (err) { next(err); }
};