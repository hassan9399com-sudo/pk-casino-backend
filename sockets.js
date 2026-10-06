const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Model path check kar lein

module.exports = (io) => {
  // JWT Authentication Middleware
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

  // Socket Connection Event
  io.on('connection', (socket) => {
    console.log(`⚡ Connected: \({socket.user.username} (\){socket.id})`);

    // Ping / Pong Test Event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Real-Time Place Bet Event
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

        // Handle default balance
        let currentBalance = typeof user.balance === 'number' ? user.balance : 1000;

        if (currentBalance < numericAmount) {
          return socket.emit('error', { message: 'Insufficient balance' });
        }

        // Deduct balance and save to MongoDB
        user.balance = currentBalance - numericAmount;
        await user.save();

        // Emit success confirmation to client
        socket.emit('bet_confirmed', {
          success: true,
          amount: numericAmount,
          betOption: betOption,
          newBalance: user.balance,
          timestamp: Date.now()
        });

        console.log(`🎰 Bet placed by \({user.username}:\){numericAmount} | New Balance: ${user.balance}`);

      } catch (err) {
        socket.emit('error', { message: 'Bet placement failed: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
    });
  });
};
