
const User = require('../models/User'); // Apne User model ka sahi path dein

// Socket Event Handler:
socket.on('place_bet', async (data) => {
  try {
    // 1. Accept both 'selectedOption', 'option', or 'bet' to prevent Postman payload mismatches
    const amount = Number(data.amount);
    const rawOption = data.selectedOption || data.option || data.bet;
    const selectedOption = rawOption ? String(rawOption).toLowerCase().trim() : null;

    // 2. Strict Validation Check
    if (!amount || isNaN(amount) || amount <= 0) {
      return socket.emit('bet_error', { message: 'Invalid bet amount' });
    }

    if (!selectedOption || !['red', 'black'].includes(selectedOption)) {
      return socket.emit('bet_error', { message: 'Bet option must be "red" or "black"' });
    }

    // 3. Atomic Balance Check & Deduction (Prevents Race Conditions)
    const updatedUser = await User.findOneAndUpdate(
      { _id: socket.user._id, balance: { $gte: amount } }, // Ensures balance is enough
      { $inc: { balance: -amount } },                       // Deducts balance safely
      { new: true }
    );

    if (!updatedUser) {
      return socket.emit('bet_error', { message: 'Insufficient wallet balance' });
    }

    // 4. Confirm Success to Client
    socket.emit('bet_success', {
      message: 'Bet placed successfully!',
      amount,
      selectedOption,
      newBalance: updatedUser.balance
    });

    // 5. Broadcast to room/all users
    io.emit('bet_pool_update', {
      amount,
      selectedOption
    });

  } catch (err) {
    console.error('Bet Handler Error:', err.message);
    socket.emit('bet_error', { message: 'Failed to place bet. Internal server error.' });
  }
});
