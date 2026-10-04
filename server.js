require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const walletRoutes = require('./routes/walletRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const errorHandler = require('./middleware/errorHandler');
const socketHandler = require('./sockets');

const app = express();
const server = http.createServer(app);

// ---------- Middleware ----------
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// Global rate limiter
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---------- Routes ----------
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// ---------- Error handler ----------
app.use(errorHandler);

// ---------- Socket.io ----------
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
socketHandler(io);
app.set('io', io);

// ---------- Boot ----------
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 PK CASINO 777 backend running on port ${PORT}`);
  });
});
