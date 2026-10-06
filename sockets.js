const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = (io) => {
  // 1. Socket Authentication
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (token && token.startsWith('Bearer ')) token = token.split(' ')[1];

      const secret = process.env.JWT_SECRET || 'pk_casino_super_secret_key_777_xyz';
      const decoded = jwt.verify(token, secret);
      
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  // 2. Real-Time Events
  io.on('connection', (socket) => {
    // User apne private room me enter ho gaya
    socket.join(`user_${socket.user._id}`);

    // Bet Placing Logic
    socket.on('place_bet', async (data) => {
      const { amount, betType } = data; // e.g. amount: 100, betType: 'red'
      
      // Balance Check
      if (socket.user.balance < amount) {
        return socket.emit('bet_response', { success: false, message: 'Low balance!' });
      }

      // Balance Deduct
      socket.user.balance -= amount;
      await socket.user.save();

      // Return Success & Updated Balance
      socket.emit('bet_response', { 
        success: true, 
        message: 'Bet placed successfully!', 
        newBalance: socket.user.balance 
      });
    });

    socket.on('disconnect', () => {});
  });
};
