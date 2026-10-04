const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ledgerService = require('../services/ledgerService');
const GameRound = require('../models/GameRound');
const { v4: uuidv4 } = require('uuid');

module.exports = function socketHandler(io) {
  // ---- Auth middleware ----
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Auth required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id phone role status');
      if (!user || user.status !== 'active') return next(new Error('Invalid user'));

      socket.user = {
        id: user._id.toString(),
        phone: user.phone,
        role: user.role,
      };
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, role } = socket.user;
    console.log(`🔌 Socket connected: ${userId} (${role})`);

    // Personal room for wallet updates
    socket.join(`user:${userId}`);
    if (role === 'admin') socket.join('admins');

    // Push initial balances
    try {
      const balances = await ledgerService.getBalances(userId);
      socket.emit('wallet_update', balances);
    } catch (err) {
      console.warn('initial balance emit failed:', err.message);
    }

    // ----------------------------------------------------
    // join_game — subscribe to game room + send current round
    // ----------------------------------------------------
    socket.on('join_game', async ({ gameType } = {}) => {
      if (!['slot', 'color_wheel', 'card'].includes(gameType)) return;
      socket.join(`game:${gameType}`);

      // Find or create an active round
      let round = await GameRound.findOne({ gameType, status: 'active' });
      if (!round) {
        round = await GameRound.create({
          roundId: uuidv4(),
          gameType,
          status: 'active',
          startedAt: new Date(),
        });
      }
      socket.emit('round_state', {
        roundId: round.roundId,
        gameType: round.gameType,
        status: round.status,
        startedAt: round.startedAt,
      });
    });

    // ----------------------------------------------------
    // place_bet — debit user and record bet
    // ----------------------------------------------------
    socket.on('place_bet', async ({ gameType, amount, selection } = {}) => {
      try {
        if (!['slot', 'color_wheel', 'card'].includes(gameType))
          throw new Error('Invalid game');
        const bet = Number(amount);
        if (!bet || bet <= 0) throw new Error('Invalid bet amount');

        // Debit main credits atomically
        const { wallet } = await ledgerService.debitMain(
          userId,
          bet,
          'BET_PLACED',
          `BET_${uuidv4()}`,
          { gameType, selection }
        );

        // Update round stats
        await GameRound.updateOne(
          { gameType, status: 'active' },
          { $inc: { betsCount: 1, totalBetAmount: bet } }
        );

        // Emit updated wallet + ack
        socket.emit('wallet_update', {
          mainCredits: wallet.mainCredits,
          winningBalance: wallet.winningBalance,
          bonusCredits: wallet.bonusCredits,
          lockedBalance: wallet.lockedBalance,
        });
        socket.emit('bet_placed', { gameType, amount: bet, selection });
      } catch (err) {
        socket.emit('bet_error', { message: err.message });
      }
    });

    // ----------------------------------------------------
    // game_timer_tick — client asks for time remaining
    // ----------------------------------------------------
    socket.on('game_timer_tick', async ({ gameType } = {}) => {
      const round = await GameRound.findOne({ gameType, status: 'active' });
      if (!round) return socket.emit('game_timer_tick', { remaining: 0 });
      const elapsed = (Date.now() - new Date(round.startedAt).getTime()) / 1000;
      const duration = 30; // seconds per round (config)
      socket.emit('game_timer_tick', {
        roundId: round.roundId,
        remaining: Math.max(0, duration - elapsed),
      });
    });

    // ----------------------------------------------------
    // disconnect
    // ----------------------------------------------------
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${userId}`);
    });
  });

  // ----------------------------------------------------
  // Simulated global game loop: every 30s, finish active
  // rounds, broadcast results, then start a new round.
  // (Replace with real game engine logic in production.)
  // ----------------------------------------------------
  setInterval(async () => {
    try {
      const activeRounds = await GameRound.find({ status: 'active' });
      for (const round of activeRounds) {
        round.status = 'finished';
        round.endedAt = new Date();
        round.outcome = { simulated: true, result: Math.random() > 0.5 ? 'win' : 'loss' };
        await round.save();

        io.to(`game:${round.gameType}`).emit('game_result', {
          roundId: round.roundId,
          gameType: round.gameType,
          outcome: round.outcome,
          endedAt: round.endedAt,
        });

        // Start a new round for this game type
        const fresh = await GameRound.create({
          roundId: uuidv4(),
          gameType: round.gameType,
          status: 'active',
          startedAt: new Date(),
        });
        io.to(`game:${round.gameType}`).emit('round_state', {
          roundId: fresh.roundId,
          gameType: fresh.gameType,
          status: fresh.status,
          startedAt: fresh.startedAt,
        });
      }
    } catch (err) {
      console.error('game loop error:', err.message);
    }
  }, 30_000);
};