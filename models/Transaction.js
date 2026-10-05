const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['deposit', 'withdraw'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [100, 'Minimum amount is 100'],
    },
    paymentMethod: {
      type: String,
      enum: ['jazzcash', 'easypaisa', 'bank_transfer'],
      required: true,
    },
    accountNumber: {
      type: String,
      required: true, // Jis account se paise bheje/mangwaye gaye hain
    },
    trxId: {
      type: String,
      required: function () {
        return this.type === 'deposit'; // Deposit ke waqt Transaction Reference ID zaroori hai
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    adminNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', transactionSchema);
