const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Wallet = require('../models/Wallet');
const LedgerEntry = require('../models/LedgerEntry');
const ApiError = require('../utils/ApiError');

const FIELD_MAP = {
  USER_MAIN: 'mainCredits',
  USER_WINNING: 'winningBalance',
  USER_BONUS: 'bonusCredits',
  USER_LOCKED: 'lockedBalance',
};

class LedgerService {
  /** Ensure wallet exists */
  async getOrCreateWallet(userId, session = null) {
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      const created = await Wallet.create([{ userId }], { session });
      wallet = created[0];
    }
    return wallet;
  }

  /**
   * Atomic double-entry transfer between two accounts.
   * - Debits `fromAccount` and credits `toAccount`.
   * - Uses conditional $inc to prevent race conditions & negative balances.
   */
  async transfer({
    userId,
    fromAccount,
    toAccount,
    amount,
    reason,
    refId,
    metadata = {},
  }) {
    if (amount <= 0) throw ApiError.badRequest('Amount must be positive');

    const session = await mongoose.startSession();
    let result;

    try {
      await session.withTransaction(async () => {
        const txId = uuidv4();
        let wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
          const created = await Wallet.create([{ userId }], { session });
          wallet = created[0];
        }

        const fromField = FIELD_MAP[fromAccount];
        const toField = FIELD_MAP[toAccount];
        const fromIsSystem = !fromField;
        const toIsSystem = !toField;

        const fromBefore = fromIsSystem ? Infinity : wallet[fromField] || 0;
        const toBefore = toIsSystem ? 0 : wallet[toField] || 0;

        if (!fromIsSystem && fromBefore < amount) {
          throw ApiError.badRequest(
            `Insufficient balance in ${fromAccount}: have ${fromBefore}, need ${amount}`
          );
        }

        const inc = {};
        if (!fromIsSystem) inc[fromField] = -amount;
        if (!toIsSystem) inc[toField] = amount;

        // Conditional update guards against concurrent debits
        const query = { userId };
        if (!fromIsSystem) query[fromField] = { $gte: amount };

        const updated = await Wallet.findOneAndUpdate(query, { $inc: inc }, {
          new: true,
          session,
        });

        if (!updated) throw ApiError.conflict('Concurrent modification — retry.');

        // Double-entry records
        const entries = [];
        if (!fromIsSystem) {
          entries.push({
            transactionId: txId,
            userId,
            account: fromAccount,
            direction: 'DEBIT',
            amount,
            balanceBefore: fromBefore,
            balanceAfter: fromBefore - amount,
            reason,
            refId,
            metadata,
          });
        }
        if (!toIsSystem) {
          entries.push({
            transactionId: txId,
            userId,
            account: toAccount,
            direction: 'CREDIT',
            amount,
            balanceBefore: toBefore,
            balanceAfter: toBefore + amount,
            reason,
            refId,
            metadata,
          });
        }
        if (entries.length) await LedgerEntry.insertMany(entries, { session });

        result = { wallet: updated, transactionId: txId };
      });
    } finally {
      session.endSession();
    }

    return result;
  }

  // Convenience helpers
  creditMain(userId, amount, reason, refId, metadata) {
    return this.transfer({
      userId,
      fromAccount: 'SYSTEM_HOUSE',
      toAccount: 'USER_MAIN',
      amount, reason, refId, metadata,
    });
  }
  debitMain(userId, amount, reason, refId, metadata) {
    return this.transfer({
      userId,
      fromAccount: 'USER_MAIN',
      toAccount: 'SYSTEM_HOUSE',
      amount, reason, refId, metadata,
    });
  }
  lockForWithdrawal(userId, amount, refId) {
    return this.transfer({
      userId,
      fromAccount: 'USER_MAIN',
      toAccount: 'USER_LOCKED',
      amount, reason: 'WITHDRAWAL_REQUEST', refId,
    });
  }
  approveWithdrawal(userId, amount, refId) {
    return this.transfer({
      userId,
      fromAccount: 'USER_LOCKED',
      toAccount: 'SYSTEM_GATEWAY',
      amount, reason: 'WITHDRAWAL_APPROVED', refId,
    });
  }
  rejectWithdrawal(userId, amount, refId) {
    return this.transfer({
      userId,
      fromAccount: 'USER_LOCKED',
      toAccount: 'USER_MAIN',
      amount, reason: 'WITHDRAWAL_REJECTED', refId,
    });
  }

  async getBalances(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return {
      mainCredits: wallet.mainCredits,
      winningBalance: wallet.winningBalance,
      bonusCredits: wallet.bonusCredits,
      lockedBalance: wallet.lockedBalance,
      currency: wallet.currency,
    };
  }
}

module.exports = new LedgerService();