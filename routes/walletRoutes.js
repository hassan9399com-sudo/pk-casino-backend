const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

// Get current user balances
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

module.exports = router;
