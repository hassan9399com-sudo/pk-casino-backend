const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdrawal'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    gateway: {
      type: String,
      default: 'Easypaisa',
    },
    accountDetails: {
      accountNumber: String,
      accountTitle: String,
      trxId: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
