const ledgerService = require('../services/ledgerService');
const LedgerEntry = require('../models/LedgerEntry');

exports.getBalance = async (req, res, next) => {
  try {
    const balances = await ledgerService.getBalances(req.user._id);
    res.json({ success: true, balances });
  } catch (err) { next(err); }
};

exports.getHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      LedgerEntry.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LedgerEntry.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      items,
    });
  } catch (err) { next(err); }
};