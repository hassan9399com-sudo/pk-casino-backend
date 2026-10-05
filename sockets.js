const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (io) => {
  // Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      // Check auth object, query parameters, or headers
      let token = 
        socket.handshake.auth?.token || 
        socket.handshake.query?.token || 
        socket.handshake.headers?.authorization || 
        socket.handshake.headers?.Authorization;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // Safely strip Bearer prefix if present
      if (typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      // Verify JWT Token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify User in DB
      const user = await User.findById(decoded.id).select('-password');
      if (!user || user.status !== 'active') {
        return next(new Error('Authentication error: User invalid or banned'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Socket Connection Handlers
  io.on('connection', (socket) => {
    console.log(`⚡ Socket Connected: ${socket.user.username || socket.user._id} (${socket.id})`);

    // User-specific private room join
    socket.join(`user_${socket.user._id}`);

    // Heartbeat Test Event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket Disconnected: (${socket.id})`);
    });
  });
};
