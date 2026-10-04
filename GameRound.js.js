const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    roundId: { type: String, required: true, unique: true, index: true },
    gameType: {
      type: String,
      enum: ['slot', 'color_wheel', 'card'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'finished'],
      default: 'waiting',
      index: true,
    },
    startedAt: Date,
    endedAt: Date,
    outcome: mongoose.Schema.Types.Mixed,
    betsCount: { type: Number, default: 0 },
    totalBetAmount: { type: Number, default: 0 },
    totalPayout: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GameRound', roundSchema);