const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['deposit', 'withdrawal'], required: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['easypaisa', 'jazzcash', 'bank', 'crypto'],
      required: true,
    },
    // Deposit-specific
    trxId: { type: String, index: true },
    screenshotUrl: String,
    // Withdrawal-specific
    payoutDetails: {
      accountNumber: String,
      accountName: String,
      bankName: String,
      walletAddress: String,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'rejected', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    adminNote: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, type: 1 });

module.exports = mongoose.model('PaymentRequest', paymentSchema);