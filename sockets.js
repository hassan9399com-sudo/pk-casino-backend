socket.on('place_bet', async (data) => {
  try {
    const { amount, betOption } = data;
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return socket.emit('error', { message: 'Invalid bet amount' });
    }

    const user = await User.findById(socket.user._id);

    if (!user) {
      return socket.emit('error', { message: 'User not found' });
    }

    // Agar existing user ka balance null/undefined hai toh 1000 assign kar de
    let currentBalance = typeof user.balance === 'number' ? user.balance : 1000;

    if (currentBalance < numericAmount) {
      return socket.emit('error', { message: 'Insufficient balance' });
    }

    // Deduct & Save
    user.balance = currentBalance - numericAmount;
    await user.save();

    // Confirm Bet Real-time
    socket.emit('bet_confirmed', {
      success: true,
      amount: numericAmount,
      betOption: betOption,
      newBalance: user.balance,
      timestamp: Date.now()
    });

    // ✅ FIXED console.log line
    console.log(`🎰 Bet placed by \({user.username}:\){numericAmount} | New Balance: ${user.balance}`);

  } catch (err) {
    socket.emit('error', { message: 'Bet placement failed: ' + err.message });
  }
});
