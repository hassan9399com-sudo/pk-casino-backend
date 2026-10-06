const jwt = require('jsonwebtoken');
const User = require('./models/User'); // Path verify kar lein

module.exports = (io) => {
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

  // Socket Connection
  io.on('connection', (socket) => {
    console.log(`⚡ Connected: \({socket.user.username} (\){socket.id})`);

    // User private room
    socket.join(`user_${socket.user._id}`);

    // Ping / Pong
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // 1. EVENT: place_bet
    socket.on('place_bet', async (data) => {
      try {
        const { amount, betOption } = data; // e.g., amount: 100, betOption: 'red'
        
        const user = await User.findById(socket.user._id);

        if (!amount || amount <= 0) {
          return socket.emit('error', { message: 'Invalid bet amount' });
        }

        if (user.balance < amount) {
          return socket.emit('error', { message: 'Insufficient balance' });
        }

        // Deduct Balance
        user.balance -= amount;
        await user.save();

        // 2. EVENT: bet_confirmed (Private reply to user)
        socket.emit('bet_confirmed', {
          success: true,
          amount: amount,
          betOption: betOption,
          newBalance: user.balance,
          timestamp: Date.now()
        });

        console.log(`🎰 Bet placed by \({user.username}:\){amount}`);

      } catch (err) {
        socket.emit('error', { message: 'Bet placement failed: ' + err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.id}`);
    });
  });
};
