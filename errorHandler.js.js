const ApiError = require('../utils/ApiError');

module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Server error',
    errors: err.errors || [],
  });
};