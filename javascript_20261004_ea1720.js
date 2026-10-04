const PaymentRequest = require('../models/PaymentRequest');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

/** GET /api/v1/admin/payments?status=pending&type=deposit */
exports.listPayments = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      PaymentRequest.find(query)
        .populate('userId', 'phone name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PaymentRequest.countDocuments(query),
    ]);

    res.json({ success: true, page: Number(page), total, items });
  } catch (err) { next(err); }
};

/** POST /api/v1/admin/payments/:requestId/approve */
exports.approvePayment = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body || {};

    const request = await PaymentRequest.findOne({ requestId });
    if (!request) throw ApiError.notFound('Payment request not found');
    if (request.status !== 'pending')
      throw ApiError.conflict(`Cannot approve — status is ${request.status}`);

    const io = req.app.get('io');

    if (request.type === 'deposit') {
      // Credit user main account from SYSTEM_HOUSE
      await ledgerService.creditMain(
        request.userId,
        request.amount,
        'DEPOSIT',
        request.requestId,
        { paymentMethod: request.paymentMethod, trxId: request.trxId }
      );
    } else {
      // Withdrawal: burn locked funds to gateway
      await ledgerService.approveWithdrawal(
        request.userId,
        request.amount,
        request.requestId
      );
    }

    request.status = 'approved';
    request.adminNote = adminNote || '';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    // Emit real-time updates
    if (io) {
      const balances = await ledgerService.getBalances(request.userId);
      io.to(`user:${request.userId}`).emit('wallet_update', balances);
      io.to(`user:${request.userId}`).emit('payment:approved', {
        requestId: request.requestId,
        type: request.type,
        amount: request.amount,
      });
    }

    res.json({ success: true, request });
  } catch (err) { next(err); }
};

/** POST /api/v1/admin/payments/:requestId/reject */
exports.rejectPayment = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { adminNote } = req.body || {};

    const request = await PaymentRequest.findOne({ requestId });
    if (!request) throw ApiError.notFound('Payment request not found');
    if (request.status !== 'pending')
      throw ApiError.conflict(`Cannot reject — status is ${request.status}`);

    const io = req.app.get('io');

    if (request.type === 'withdrawal') {
      // Unlock funds back to user main
      await ledgerService.rejectWithdrawal(
        request.userId,
        request.amount,
        request.requestId
      );
    }

    request.status = 'rejected';
    request.adminNote = adminNote || '';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await request.save();

    if (io) {
      const balances = await ledgerService.getBalances(request.userId);
      io.to(`user:${request.userId}`).emit('wallet_update', balances);
      io.to(`user:${request.userId}`).emit('payment:rejected', {
        requestId: request.requestId,
        type: request.type,
        amount: request.amount,
        adminNote: request.adminNote,
      });
    }

    res.json({ success: true, request });
  } catch (err) { next(err); }
};