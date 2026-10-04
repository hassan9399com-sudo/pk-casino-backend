const ApiError = require('../utils/ApiError');

module.exports = (err, req, res, next) => {
  console.error('❌ Error Logged:', err);

  // ApiError instance handling
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value entered for ${field}`,
    });
  }

  // Fallback for unhandled internal server errors
  return res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
};
