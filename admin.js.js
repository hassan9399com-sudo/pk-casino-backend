const ApiError = require('../utils/ApiError');

module.exports = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};