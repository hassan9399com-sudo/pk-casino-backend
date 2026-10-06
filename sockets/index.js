const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (io) => {
  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.authorization?.split(' ')[1] || socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Attach decoded user info (or payload id) to socket
      socket.user = decoded; // Must contain _id or id
      
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: \({socket.id}, User ID:\){socket.user?.id || socket.user?._id}`);

    socket.on('place_bet', async (data) => {
      try {
        // Safe check for User ID from JWT Payload
        const userId = socket.user?._id || socket.user?.id;

        if (!userId) {
          return socket.emit('bet_error', { message: 'Unauthorized: Invalid token payload' });
        }

        const amount = Number(data.amount);
        const rawOption = data.selectedOption || data.option || data.bet;
        const selectedOption = rawOption ? String(rawOption).toLowerCase().trim() : null;

        if (!amount || isNaN(amount) || amount <= 0) {
          return socket.emit('bet_error', { message: 'Invalid bet amount' });
        }

        if (!selectedOption || !['red', 'black'].includes(selectedOption)) {
          return socket.emit('bet_error', { message: 'Bet option must be "red" or "black"' });
        }

        // Find user & update balance safely
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { new: true }
        );

        if (!updatedUser) {
          return socket.emit('bet_error', { message: 'Insufficient balance or user not found' });
        }

        socket.emit('bet_success', {
          message: 'Bet placed successfully!',
          amount,
          selectedOption,
          newBalance: updatedUser.balance
        });

        io.emit('bet_pool_update', {
          amount,
          selectedOption
        });

      } catch (err) {
        console.error('Bet Handler Error:', err.message);
        socket.emit('bet_error', { message: 'Failed to place bet. Server error.' });
      }
    });
  });
};
