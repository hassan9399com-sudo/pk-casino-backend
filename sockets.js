const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (io) => {
  // Game State Variables
  let isBettingOpen = true;
  let roundTimer = 10; // 10 seconds per round
  let currentRoundBets = []; // Array to store round bets: [{ userId, socketId, amount, betOption }]

  // Auth Middleware
  io.use(async (socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.headers?.Authorization;

      if (!token) return next(new Error('Authentication error: Token missing'));
      if (typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      const secret = process.env.JWT_SECRET || 'pk_casino_super_secret_key_777_xyz';
      const decoded = jwt.verify(token, secret);

      const user = await User.findById(decoded.id).select('-password');
      if (!user || user.status !== 'active') {
        return next(new Error('Authentication error: User invalid or banned'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // -------------------------------------------------------------
  // AUTOMATIC GAME ENGINE LOOP (Runs every 10 Seconds)
  // -------------------------------------------------------------
  setInterval(async () => {
    // 1. Lock Bets & Determine Winning Outcome
    isBettingOpen = false;
    const options = ['red', 'black'];
    const winningOption = options[Math.floor(Math.random() * options.length)];

    console.log(`🎰 Round ended! Winning Option: ${winningOption.toUpperCase()}`);

    // 2. Process Payouts for Winners
    const roundSummary = [];

    for (const bet of currentRoundBets) {
      const isWinner = bet.betOption === winningOption;
      let payout = 0;
      let updatedBalance = null;

      if (isWinner) {
        payout = bet.amount * 2; // 2x Payout multiplier
        const user = await User.findByIdAndUpdate(
          bet.userId,
          { $inc: { balance: payout } },
          { new: true }
        );
        updatedBalance = user.balance;
      } else {
        const user = await User.findById(bet.userId);
        updatedBalance = user.balance;
      }

      // Private Notification to Player
      io.to(bet.socketId).emit('round_outcome', {
        won: isWinner,
        payout: payout,
        betOption: bet.betOption,
        winningOption: winningOption,
        newBalance: updatedBalance
      });

      roundSummary.push({
        user: bet.username,
        amount: bet.amount,
        betOption: bet.betOption,
        won: isWinner,
        payout: payout
      });
    }

    // 3. Broadcast Game Result to ALL Connected Clients
    io.emit('game_result', {
      winningOption: winningOption,
      totalBetsPlaced: currentRoundBets.length,
      timestamp: Date.now()
    });

    // 4. Reset for Next Round
    currentRoundBets = [];
    
    setTimeout(() => {
      isBettingOpen = true;
      io.emit('round_start', {
        message: 'Place your bets now!',
        timeRemaining: roundTimer,
        timestamp: Date.now()
      });
      console.log('🏁 New Round Started! Betting Open.');
    }, 2000); // 2 second pause before next round

  }, 12000); // 10s betting window + 2s outcome delay

  // Socket Connections
  io.on('connection', (socket) => {
    console.log(`⚡ Connected: \({socket.user.username} (\){socket.id})`);

    // Handle Bet Placement
    socket.on('place_bet', async (data) => {
      try {
        if (!isBettingOpen) {
          return socket.emit('error', { message: 'Betting is currently closed. Wait for next round!' });
        }

        const { amount, betOption } = data;
        const numericAmount = Number(amount);

        if (!numericAmount || numericAmount <= 0) {
          return socket.emit('error', { message: 'Invalid bet amount' });
        }

        if (!['red', 'black'].includes(betOption)) {
          return socket.emit('error', { message: 'Bet option must be "red" or "black"' });
        }

        const user = await User.findById(socket.user._id);
        let currentBalance = typeof user.balance === 'number' ? user.balance : 1000;

        if (currentBalance < numericAmount) {
          return socket.emit('error', { message: 'Insufficient balance' });
        }

        // Deduct Bet Amount
        user.balance = currentBalance - numericAmount;
        await user.save();

        // Push to active bets memory
        currentRoundBets.push({
          userId: user._id,
          username: user.username,
          socketId: socket.id,
          amount: numericAmount,
          betOption: betOption
        });

        // Send confirmation
        socket.emit('bet_confirmed', {
          success: true,
          amount: numericAmount,
          betOption: betOption,
          newBalance: user.balance,
          timestamp: Date.now()
        });

      } catch (err) {
        socket.emit('error', { message: 'Bet placement failed: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
    });
  });
};
