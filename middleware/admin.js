const ApiError = require('../utils/ApiError');

module.exports = (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }
  
  if (req.user.role !== 'admin') {
    return next(ApiError.forbidden('Access denied. Admin rights required.'));
  }
  
  next();
};
