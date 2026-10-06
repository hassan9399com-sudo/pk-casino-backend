const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['player', 'admin'], default: 'player' },
    status: { type: String, enum: ['active', 'banned'], default: 'active' },
    // ⬇️ Real-Time Balance Field Added
    balance: { 
      type: Number, 
      default: 1000, // Default signup balance (apne hisab se change kar sakte hain)
      min: 0 
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
