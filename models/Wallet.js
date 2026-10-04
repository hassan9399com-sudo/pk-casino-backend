const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    mainCredits: { type: Number, default: 0, min: 0 },
    winningBalance: { type: Number, default: 0, min: 0 },
    bonusCredits: { type: Number, default: 0, min: 0 },
    lockedBalance: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'PKR' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Wallet', walletSchema);
