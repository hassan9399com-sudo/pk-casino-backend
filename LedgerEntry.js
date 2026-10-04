const mongoose = require('mongoose');

/**
 * Append-only double-entry ledger. Every money movement writes
 * a DEBIT + CREDIT pair sharing the same transactionId.
 */
const ledgerSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    account: {
      type: String,
      enum: [
        'USER_MAIN',
        'USER_WINNING',
        'USER_BONUS',
        'USER_LOCKED',
        'SYSTEM_HOUSE',
        'SYSTEM_GATEWAY',
      ],
      required: true,
      index: true,
    },
    direction: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: Number,
    balanceAfter: Number,
    reason: {
      type: String,
      enum: [
        'DEPOSIT',
        'WITHDRAWAL_REQUEST',
        'WITHDRAWAL_APPROVED',
        'WITHDRAWAL_REJECTED',
        'BET_PLACED',
        'BET_WON',
        'BONUS_CREDIT',
        'ADJUSTMENT',
      ],
      required: true,
    },
    refId: String,
    metadata: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

ledgerSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerSchema);