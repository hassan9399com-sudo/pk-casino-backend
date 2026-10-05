const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (io) => {
  // Socket.io Authentication Middleware
  io.use(async (socket, next) => {
    try {
      // 1. Token Extract (Headers, Query, ya Auth object se)
      let token = 
        socket.handshake.auth?.token || 
        socket.handshake.query?.token || 
        socket.handshake.headers?.authorization || 
        socket.handshake.headers?.Authorization;

      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      // 2. Bearer prefix clean karein
      if (typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      // 3. Exact same Secret Key use karein jo HTTP Auth endpoints me istemal ho rahi hai
      const secret = process.env.JWT_SECRET || 'pk_casino_super_secret_key_777_xyz';

      // 4. Token Verify
      const decoded = jwt.verify(token, secret);

      // 5. User Check in DB
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
    console.log(`⚡ Socket Connected: \({socket.user.username || socket.user._id} (\){socket.id})`);

    // User Private Room Join (For Live Balance Updates)
    socket.join(`user_${socket.user._id}`);

    // Heartbeat / Ping Event
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket Disconnected: (${socket.id})`);
    });
  });
};
