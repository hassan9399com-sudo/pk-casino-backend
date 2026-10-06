import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://pk-casino-backend.onrender.com';

export const useCasinoSocket = (token) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState({
    status: 'BETTING', // 'BETTING' or 'SPINNING'
    timeLeft: 15,
  });
  const [lastResult, setLastResult] = useState(null);
  const [betError, setBetError] = useState(null);
  const [betSuccess, setBetSuccess] = useState(null);
  const [userBalance, setUserBalance] = useState(null);

  useEffect(() => {
    if (!token) return;

    // 1. Initialize Socket Connection with Auth Header
    socketRef.current = io(SOCKET_URL, {
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
      transports: ['websocket'],
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Casino Socket Server');
    });

    // 2. Event Listeners
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
      setLastResult(data); // { winningOption: 'red'|'black'|'green', multiplier: 2|14 }
    });

    socket.on('bet_success', (data) => {
      setBetSuccess(data.message);
      setBetError(null);
      setUserBalance(data.newBalance);
    });

    socket.on('bet_error', (data) => {
      setBetError(data.message);
      setBetSuccess(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Clean up on unmount
    return () => {
      socket.disconnect();
    };
  }, [token]);

  // 3. Emit Bet Function
  const placeBet = (amount, selectedOption) => {
    if (!socketRef.current || !isConnected) {
      setBetError('Socket not connected');
      return;
    }
    setBetError(null);
    setBetSuccess(null);
    socketRef.current.emit('place_bet', { amount, selectedOption });
  };

  return {
    isConnected,
    gameState,
    lastResult,
    betError,
    betSuccess,
    userBalance,
    placeBet,
  };
};
