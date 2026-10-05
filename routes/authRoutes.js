const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const ApiError = require('../utils/ApiError');

// Secret Key Fallback Handling (Render Variable Miss Ho Tab Bhi Crashes Na Ho)
const JWT_SECRET = process.env.JWT_SECRET || 'pk_casino_default_secret_key_777';

// Register Route
router.post('/register', async (req, res, next) => {
  try {
    const { username, phone, password } = req.body;

    if (!username || !phone || !password) {
      throw ApiError.badRequest('Username, phone, and password are required');
    }

    const existingUser = await User.findOne({ $or: [{ username }, { phone }] });
    if (existingUser) {
      throw ApiError.conflict('Username or phone already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      phone,
      password: hashedPassword,
    });

    // Create default wallet
    await Wallet.create({ userId: user._id });

    // JWT_SECRET variable variable pass kiya gaya hai
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// Login Route
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw ApiError.badRequest('Username and password are required');
    }

    const user = await User.findOne({ username });
    if (!user) throw ApiError.unauthorized('Invalid credentials');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw ApiError.unauthorized('Invalid credentials');

    if (user.status !== 'active') throw ApiError.forbidden('Account is banned');

    // JWT_SECRET variable variable pass kiya gaya hai
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
