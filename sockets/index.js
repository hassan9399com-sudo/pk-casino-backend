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
      const token =
        socket.handshake.headers.authorization?.split(' ')[1] ||
        socket.handshake.auth?.token;

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
          newBalance: updatedUser.balance,
        });

        io.emit('bet_pool_update', {
          totalBets: gameState.currentRoundBets.length,
          latestBet: { amount, selectedOption },
        });
      } catch (err) {
        console.error('Bet Error:', err.message);
        socket.emit('bet_error', { message: 'Internal server error during bet placement' });
      }
    });
  });
};

// --- Controlled House Edge Outcome & Controlled Payout Logic ---
async function resolveRound(io) {
  try {
    const bets = gameState.currentRoundBets;

    // Direct Default Option (Agar koi bet na lagi ho)
    if (bets.length === 0) {
      const options = ['red', 'black', 'green'];
      const defaultOption = options[Math.floor(Math.random() * options.length)];
      
      setTimeout(() => {
        io.emit('round_result', { winningOption: defaultOption, multiplier: 2 });
        resetGameState(io);
      }, 4000);
      return;
    }

    // 1. Total Pool & Company Profit (35% Average House Cut)
    const totalPot = bets.reduce((sum, b) => sum + b.amount, 0);
    const houseEdge = 0.35; // 35% Safe House Cut
    const maxPayoutBudget = totalPot * (1 - houseEdge); // 65% Budget available for winners

    const multipliers = { red: 2, black: 2, green: 14 };
    const options = ['red', 'black', 'green'];

    // 2. Wo options filter karein jin par total payout budget se kam ban raha ho
    let safeOptions = options.filter(opt => {
      const optionPayout = bets
        .filter(b => b.selectedOption === opt)
        .reduce((sum, b) => sum + (b.amount * multipliers[opt]), 0);

      return optionPayout <= maxPayoutBudget;
    });

    // Agar sab options budget se bahar hon, sab se kam payout wala option chunein
    let winningOption;
    if (safeOptions.length > 0) {
      winningOption = safeOptions[Math.floor(Math.random() * safeOptions.length)];
    } else {
      winningOption = options.reduce((minOpt, opt) => {
        const payout = bets
          .filter(b => b.selectedOption === opt)
          .reduce((sum, b) => sum + (b.amount * multipliers[opt]), 0);
        
        const minPayout = bets
          .filter(b => b.selectedOption === minOpt)
          .reduce((sum, b) => sum + (b.amount * multipliers[minOpt]), 0);

        return payout < minPayout ? opt : minOpt;
      }, options[0]);
    }

    // 3. Winning Options ke bets me se 1 se 6 Winners Cap Lagana
    let winnerBets = bets.filter(b => b.selectedOption === winningOption);
    
    // Random 1 se 6 winners limit
    const maxWinners = Math.min(6, Math.max(1, Math.floor(Math.random() * 6) + 1));
    
    // Shuffle winners list
    winnerBets = winnerBets.sort(() => 0.5 - Math.random()).slice(0, maxWinners);

    console.log(`🎲 Calculated Winning Option: ${winningOption.toUpperCase()} | Active Winners Count: ${winnerBets.length}`);

    // 4. Wait 4 seconds for wheel animation
    setTimeout(async () => {
      try {
        const winnerMultiplier = multipliers[winningOption];

        // Selected capped winners ko payout dein
        const payoutPromises = winnerBets.map((bet) => {
          const winAmount = bet.amount * winnerMultiplier;
          return User.findByIdAndUpdate(bet.userId, { $inc: { balance: winAmount } });
        });

        await Promise.all(payoutPromises);

        // Broadcast Round Result
        io.emit('round_result', {
          winningOption,
          multiplier: winnerMultiplier,
        });
      } catch (payoutErr) {
        console.error('Error during payout:', payoutErr.message);
      } finally {
        resetGameState(io);
      }
    }, 4000);

  } catch (err) {
    console.error('Error in resolveRound:', err.message);
    resetGameState(io);
  }
}

// Reset Game Loop State Helper Function
function resetGameState(io) {
  gameState.status = 'BETTING';
  gameState.timeLeft = 15;
  gameState.currentRoundBets = [];
  io.emit('game_status', { status: 'BETTING', timeLeft: 15 });
}
