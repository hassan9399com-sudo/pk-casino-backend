const User = require('../models/User');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('place_bet', async (data) => {
      try {
        // 1. Flexibly extract parameters
        const amount = Number(data.amount);
        const rawOption = data.selectedOption || data.option || data.bet;
        const selectedOption = rawOption ? String(rawOption).toLowerCase().trim() : null;

        // 2. Amount Validation
        if (!amount || isNaN(amount) || amount <= 0) {
          return socket.emit('bet_error', { message: 'Invalid bet amount' });
        }

        // 3. Bet Option Validation ('red' or 'black')
        if (!selectedOption || !['red', 'black'].includes(selectedOption)) {
          return socket.emit('bet_error', { message: 'Bet option must be "red" or "black"' });
        }

        // 4. Atomic Balance Check & Deduction
        const updatedUser = await User.findOneAndUpdate(
          { _id: socket.user._id, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { new: true }
        );

        if (!updatedUser) {
          return socket.emit('bet_error', { message: 'Insufficient wallet balance' });
        }

        // 5. Send Success Response
        socket.emit('bet_success', {
          message: 'Bet placed successfully!',
          amount,
          selectedOption,
          newBalance: updatedUser.balance
        });

        // 6. Broadcast to all users
        io.emit('bet_pool_update', {
          amount,
          selectedOption
        });

      } catch (err) {
        console.error('Bet Handler Error:', err.message);
        socket.emit('bet_error', { message: 'Failed to place bet. Server error.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
