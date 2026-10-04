const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (io) => {
  // Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user || user.status !== 'active') {
        return next(new Error('Authentication error: User invalid or banned'));
      }

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Socket Connection Handlers
  io.on('connection', (socket) => {
    console.log(`⚡ Socket Connected: ${socket.user.username} (${socket.id})`);

    // User-specific private room join
    socket.join(`user_${socket.user._id}`);

    // Ping / Pong for heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket Disconnected: ${socket.user.username} (${socket.id})`);
    });
  });
};
