// sockets/index.js ke io.on('connection') ke andar add karein:

socket.on('place_bet', async (data) => {
  try {
    const { amount, selectedOption } = data; // e.g. amount: 100, selectedOption: 'red'

    // 1. Basic validation
    if (!amount || amount <= 0 || !selectedOption) {
      return socket.emit('bet_error', { message: 'Invalid bet details' });
    }

    // 2. Fresh User Balance Fetch
    const user = await User.findById(socket.user._id);
    if (!user || user.balance < amount) {
      return socket.emit('bet_error', { message: 'Insufficient wallet balance' });
    }

    // 3. Deduct Balance & Save
    user.balance -= amount;
    await user.save();

    // 4. Confirm Bet Success & Send Updated Balance
    socket.emit('bet_success', {
      message: 'Bet placed successfully!',
      amount,
      selectedOption,
      newBalance: user.balance
    });

    // Option: Broadcast total pool update to all players
    io.emit('bet_pool_update', {
      amount,
      selectedOption
    });

  } catch (err) {
    console.error('Bet Error:', err.message);
    socket.emit('bet_error', { message: 'Failed to place bet' });
  }
});
