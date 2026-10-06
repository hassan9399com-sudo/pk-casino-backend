import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Aapke Render Backend Server ka URL
const SOCKET_URL = 'https://pk-casino-backend.onrender.com';

export default function App() {
  // Login / Postman se mila hua JWT Token yahan paste karein
  const [token, setToken] = useState('YOUR_JWT_TOKEN_HERE');
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(100);

  // Socket & Game States
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState({ status: 'BETTING', timeLeft: 15 });
  const [lastResult, setLastResult] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 1. Socket Connection & Event Listeners
  useEffect(() => {
    if (!token || token === 'YOUR_JWT_TOKEN_HERE') return;

    socketRef.current = io(SOCKET_URL, {
      extraHeaders: { Authorization: `Bearer ${token}` },
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      setErrorMessage('');
    });

    socket.on('timer_tick', (data) => {
      setGameState((prev) => ({
        ...prev,
        timeLeft: data.timeLeft,
        status: data.status || prev.status,
      }));
    });

    socket.on('game_status', (data) => {
      setGameState((prev) => ({
        ...prev,
        status: data.status,
        ...(data.timeLeft !== undefined && { timeLeft: data.timeLeft }),
      }));
    });

    socket.on('round_result', (data) => {
      setLastResult(data);
    });

    socket.on('bet_success', (data) => {
      setStatusMessage(data.message);
      setErrorMessage('');
      if (data.newBalance !== undefined) {
        setBalance(data.newBalance);
      }
    });

    socket.on('bet_error', (data) => {
      setErrorMessage(data.message);
      setStatusMessage('');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // 2. Bet Send karne ka function
  const handlePlaceBet = (selectedOption) => {
    if (!socketRef.current || !isConnected) {
      setErrorMessage('Socket server connected nahi hai.');
      return;
    }
    setStatusMessage('');
    setErrorMessage('');
    socketRef.current.emit('place_bet', {
      amount: Number(betAmount),
      selectedOption: selectedOption,
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>PK Casino 777 - Roulette</h1>

        {/* Connection Status */}
        <div style={styles.statusBadge}>
          Status:{' '}
          <span style={{ color: isConnected ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
            {isConnected ? 'Connected 🟢' : 'Disconnected 🔴'}
          </span>
        </div>

        {/* User Balance */}
        <div style={styles.balanceBox}>
          <h3>Wallet Balance</h3>
          <h2>Rs. {balance}</h2>
        </div>

        {/* Live Timer / Phase */}
        <div style={styles.timerBox}>
          <p style={{ margin: 0, fontSize: '14px', color: '#aaa' }}>GAME STATUS</p>
          <h2 style={{ color: gameState.status === 'BETTING' ? '#FFD700' : '#FF5722', margin: '5px 0' }}>
            {gameState.status === 'BETTING'
              ? `Betting Phase: ${gameState.timeLeft}s`
              : 'Spinning Wheel... 🎲'}
          </h2>
        </div>

        {/* Winning Result */}
        {lastResult && (
          <div style={styles.resultBox}>
            Winning Outcome:{' '}
            <strong style={{ color: lastResult.winningOption, textTransform: 'uppercase' }}>
              {lastResult.winningOption} ({lastResult.multiplier}x)
            </strong>
          </div>
        )}

        {/* Betting Controls */}
        <div style={styles.controls}>
          <label style={{ display: 'block', marginBottom: '8px' }}>Bet Amount:</label>
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={gameState.status !== 'BETTING'}
            style={styles.input}
          />

          <div style={styles.buttonGroup}>
            <button
              onClick={() => handlePlaceBet('red')}
              disabled={gameState.status !== 'BETTING'}
              style={{ ...styles.btn, backgroundColor: '#d32f2f' }}
            >
              RED (2x)
            </button>
            <button
              onClick={() => handlePlaceBet('black')}
              disabled={gameState.status !== 'BETTING'}
              style={{ ...styles.btn, backgroundColor: '#212121' }}
            >
              BLACK (2x)
            </button>
            <button
              onClick={() => handlePlaceBet('green')}
              disabled={gameState.status !== 'BETTING'}
              style={{ ...styles.btn, backgroundColor: '#388E3C' }}
            >
              GREEN (14x)
            </button>
          </div>
        </div>

        {/* Response Alerts */}
        {statusMessage && <p style={{ color: '#4CAF50', marginTop: '15px' }}>{statusMessage}</p>}
        {errorMessage && <p style={{ color: '#F44336', marginTop: '15px' }}>{errorMessage}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: '#121212',
    color: '#ffffff',
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  card: {
    backgroundColor: '#1e1e1e',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    maxWidth: '450px',
    width: '100%',
    textAlign: 'center',
  },
  title: { margin: '0 0 10px 0', fontSize: '22px' },
  statusBadge: { fontSize: '14px', marginBottom: '15px' },
  balanceBox: {
    backgroundColor: '#2a2a2a',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  timerBox: {
    backgroundColor: '#333',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  resultBox: {
    backgroundColor: '#263238',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '15px',
  },
  controls: { textAlign: 'left', marginTop: '15px' },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    boxSizing: 'border-box',
    marginBottom: '15px',
  },
  buttonGroup: { display: 'flex', gap: '10px' },
  btn: {
    flex: 1,
    padding: '12px',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};
