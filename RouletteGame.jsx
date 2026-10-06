import React, { useState } from 'react';
import { useCasinoSocket } from './useCasinoSocket';

export const RouletteGame = ({ userToken, initialBalance }) => {
  const {
    isConnected,
    gameState,
    lastResult,
    betError,
    betSuccess,
    userBalance,
    placeBet,
  } = useCasinoSocket(userToken);

  const [betAmount, setBetAmount] = useState(100);
  const currentBalance = userBalance ?? initialBalance;

  const handleBet = (option) => {
    placeBet(betAmount, option);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '500px' }}>
      <h2>PK Casino 777 - Roulette</h2>
      
      {/* Connection Status */}
      <p>
        Status:{' '}
        <strong style={{ color: isConnected ? 'green' : 'red' }}>
          {isConnected ? 'Connected 🟢' : 'Connecting... 🔴'}
        </strong>
      </p>

      {/* Balance */}
      <h3>Wallet Balance: Rs. {currentBalance}</h3>

      {/* Timer & Status */}
      <div style={{ background: '#222', color: '#fff', padding: '15px', borderRadius: '8px' }}>
        <h3>
          {gameState.status === 'BETTING'
            ? `Place Bets: ${gameState.timeLeft}s`
            : 'Spinning Wheel... 🎲'}
        </h3>
      </div>

      {/* Outcome Result */}
      {lastResult && (
        <div style={{ marginTop: '10px', padding: '10px', background: '#eee' }}>
          Winning Result: <strong>{lastResult.winningOption.toUpperCase()}</strong> ({lastResult.multiplier}x)
        </div>
      )}

      {/* Bet Controls */}
      <div style={{ marginTop: '20px' }}>
        <label>Bet Amount: </label>
        <input
          type="number"
          value={betAmount}
          onChange={(e) => setBetAmount(Number(e.target.value))}
          disabled={gameState.status !== 'BETTING'}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button
            onClick={() => handleBet('red')}
            disabled={gameState.status !== 'BETTING'}
            style={{ backgroundColor: 'red', color: 'white', padding: '10px 20px' }}
          >
            Bet RED (2x)
          </button>
          <button
            onClick={() => handleBet('black')}
            disabled={gameState.status !== 'BETTING'}
            style={{ backgroundColor: 'black', color: 'white', padding: '10px 20px' }}
          >
            Bet BLACK (2x)
          </button>
          <button
            onClick={() => handleBet('green')}
            disabled={gameState.status !== 'BETTING'}
            style={{ backgroundColor: 'green', color: 'white', padding: '10px 20px' }}
          >
            Bet GREEN (14x)
          </button>
        </div>
      </div>

      {/* Notifications */}
      {betSuccess && <p style={{ color: 'green', fontWeight: 'bold' }}>{betSuccess}</p>}
      {betError && <p style={{ color: 'red', fontWeight: 'bold' }}>{betError}</p>}
    </div>
  );
};
