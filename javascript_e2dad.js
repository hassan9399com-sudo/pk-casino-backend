const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\+?[0-9]{10,15}$/,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    name: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    payoutDetails: {
      method: { type: String, enum: ['easypaisa', 'jazzcash', 'bank', 'crypto', null], default: null },
      accountNumber: String,
      accountName: String,
      bankName: String,
      walletAddress: String,
    },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);