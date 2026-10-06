socket.on('place_bet', async (data) => {
  try {
    const { amount, betOption } = data;
    
    // Ensure amount is integer/float
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return socket.emit('error', { message: 'Invalid bet amount' });
    }

    const user = await User.findById(socket.user._id);

    // Fallback if balance field is undefined/null in DB
    const currentBalance = user.balance ?? 0;

    if (currentBalance < numericAmount) {
      return socket.emit('error', { message: 'Insufficient balance' });
    }

    // Deduct and Save
    user.balance = currentBalance - numericAmount;
    await user.save();

    // Confirm Bet
    socket.emit('bet_confirmed', {
      success: true,
      amount: numericAmount,
      betOption: betOption,
      newBalance: user.balance,
      timestamp: Date.now()
    });

    console.log(`🎰 Bet placed: \({numericAmount} | New Balance:\){user.balance}`);

  } catch (err) {
    socket.emit('error', { message: 'Bet placement failed: ' + err.message });
  }
});
