const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Game State Storage
let gameState = {
  status: 'BETTING', // 'BETTING' or 'SPINNING'
  timeLeft: 15,
  currentRoundBets: [], // Stores { userId, amount, selectedOption }
};

let isLoopRunning = false; // Duplicate timer se bachane ke liye

module.exports = (io) => {
  // --- Socket JWT Middleware ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.headers.authorization?.split(' ')[1] || socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication error: Token missing'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // --- Game Loop (Sirf 1 baar chalega) ---
  if (!isLoopRunning) {
    isLoopRunning = true;
    setInterval(async () => {
      if (gameState.status === 'BETTING') {
        gameState.timeLeft--;

        // Broadcast countdown tick
        io.emit('timer_tick', { status: gameState.status, timeLeft: gameState.timeLeft });

        if (gameState.timeLeft <= 0) {
          gameState.status = 'SPINNING';
          io.emit('game_status', { status: 'SPINNING', message: 'Betting closed! Spinning wheel...' });

          // Calculate Outcome
          await resolveRound(io);
        }
      }
    }, 1000);
  }

  // --- Connection & Event Handlers ---
  io.on('connection', (socket) => {
    // Send initial game state on connect
    socket.emit('game_state_init', gameState);

    socket.on('place_bet', async (data) => {
      try {
        if (gameState.status !== 'BETTING') {
          return socket.emit('bet_error', { message: 'Betting phase closed! Wait for next round.' });
        }

        const userId = socket.user?._id || socket.user?.id;
        if (!userId) {
          return socket.emit('bet_error', { message: 'Unauthorized user.' });
        }

        const amount = Number(data.amount);
        const rawOption = data.selectedOption || data.option || data.bet;
        const selectedOption = rawOption ? String(rawOption).toLowerCase().trim() : null;

        if (!amount || isNaN(amount) || amount <= 0) {
          return socket.emit('bet_error', { message: 'Invalid bet amount' });
        }

        if (!selectedOption || !['red', 'black', 'green'].includes(selectedOption)) {
          return socket.emit('bet_error', { message: 'Option must be red, black, or green' });
        }

        // Deduct balance atomically
        const updatedUser = await User.findOneAndUpdate(
          { _id: userId, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { new: true }
        );

        if (!updatedUser) {
          return socket.emit('bet_error', { message: 'Insufficient wallet balance' });
        }

        // Record bet for payout phase
        gameState.currentRoundBets.push({ userId, amount, selectedOption });

        socket.emit('bet_success', {
          message: 'Bet placed successfully!',
          amount,
          selectedOption,
          newBalance: updatedUser.balance
        });

        io.emit('bet_pool_update', {
          totalBets: gameState.currentRoundBets.length,
          latestBet: { amount, selectedOption }
        });

      } catch (err) {
        console.error('Bet Error:', err.message);
        socket.emit('bet_error', { message: 'Internal server error during bet placement' });
      }
    });
  });
};

// --- Round Outcome & Fast Payout Logic ---
async function resolveRound(io) {
  // 1. Generate Weighted Outcome
  // Red: 0-47 (48%), Black: 48-95 (48%), Green: 96-99 (4%)
  const rand = Math.floor(Math.random() * 100);
  let winningOption = 'red';
  if (rand >= 48 && rand < 96) winningOption = 'black';
  if (rand >= 96) winningOption = 'green';

  console.log(`🎲 Round Outcome: ${winningOption.toUpperCase()}`);

  // 2. Wait 4 seconds for wheel animation
  setTimeout(async () => {
    // 3. Process Payouts Parallelly
    const multipliers = { red: 2, black: 2, green: 14 };
    const winnerMultiplier = multipliers[winningOption];

    const payoutPromises = gameState.currentRoundBets
      .filter((bet) => bet.selectedOption === winningOption)
      .map((bet) => {
        const winAmount = bet.amount * winnerMultiplier;
        return User.findByIdAndUpdate(bet.userId, { $inc: { balance: winAmount });
      });

    await Promise.all(payoutPromises);

    // 4. Broadcast Round Result
    io.emit('round_result', {
      winningOption,
      multiplier: winnerMultiplier
    });

    // 5. Reset Game Loop
    gameState.status = 'BETTING';
    gameState.timeLeft = 15;
    gameState.currentRoundBets = [];

    io.emit('game_status', { status: 'BETTING', timeLeft: 15 });
  }, 4000);
}
