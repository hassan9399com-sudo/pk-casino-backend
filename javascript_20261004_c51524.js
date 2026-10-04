const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const ledgerService = require('../services/ledgerService');
const ApiError = require('../utils/ApiError');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Validation failed', errors.array());

    const { phone, password, name } = req.body;
    const exists = await User.findOne({ phone });
    if (exists) throw ApiError.conflict('Phone already registered');

    const user = await User.create({ phone, password, name });
    await ledgerService.getOrCreateWallet(user._id);

    res.status(201).json({
      success: true,
      token: signToken(user),
      user: { id: user._id, phone: user.phone, name: user.name, role: user.role },
    });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw ApiError.badRequest('Validation failed', errors.array());

    const { phone, password } = req.body;
    const user = await User.findOne({ phone }).select('+password');
    if (!user) throw ApiError.unauthorized('Invalid credentials');
    if (user.status !== 'active') throw ApiError.forbidden('Account not active');

    const ok = await user.comparePassword(password);
    if (!ok) throw ApiError.unauthorized('Invalid credentials');

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    await ledgerService.getOrCreateWallet(user._id);

    res.json({
      success: true,
      token: signToken(user),
      user: { id: user._id, phone: user.phone, name: user.name, role: user.role },
    });
  } catch (err) { next(err); }
};

exports.me = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      phone: req.user.phone,
      name: req.user.name,
      role: req.user.role,
    },
  });
};