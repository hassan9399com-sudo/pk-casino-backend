const User = require('../models/User'); 
socket.on('place_bet', async (data) => {
  try {
const amount = Number(data.amount);
    const rawOption = data.selectedOption || data.option || data.bet;
    const selectedOption = rawOption ? String(rawOption).toLowerCase().trim() : null;
 if (!amount || isNaN(amount) || amount <= 0) {
      return socket.emit('bet_error', { message: 'Invalid bet amount' });
    }

    if (!selectedOption || !['red', 'black'].includes(selectedOption)) {
      return socket.emit('bet_error', { message: 'Bet option must be "red" or "black"' });
    }
const updatedUser = await User.findOneAndUpdate(
      { _id: socket.user._id, balance: { $gte: amount } }, 
      { $inc: { balance: -amount } },                       
      { new: true }
    );

    if (!updatedUser) {
      return socket.emit('bet_error', { message: 'Insufficient wallet balance' });
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
    socket.emit('bet_error', { message: 'Failed to place bet. Internal server error.' });
  }
});
