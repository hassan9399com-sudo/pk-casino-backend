const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

module.exports = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing token');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) throw ApiError.unauthorized('User not found');
    if (user.status !== 'active') throw ApiError.forbidden('Account not active');

    req.user = user;
    next();
  } catch (err) {
    next(err.name === 'JsonWebTokenError' ? ApiError.unauthorized('Invalid token') : err);
  }
};
