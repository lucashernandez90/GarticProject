import React, { useEffect, useState } from 'react';
import './Timer.css';
import socket from '../socket';

export default function Timer() {
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutos por rodada
  const [currentRound, setCurrentRound] = useState(1);

  useEffect(() => {
    const handleNewRound = ({ currentRound }) => {
      setCurrentRound(currentRound);
      setTimeLeft(120);
      console.log(`Nova rodada iniciada: ${currentRound}`);
    };

    const handleTimeUpdate = ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    };

    socket.on('new_round', handleNewRound);
    socket.on('time_update', handleTimeUpdate);

    return () => {
      socket.off('new_round', handleNewRound);
      socket.off('time_update', handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      socket.emit('time_ended');
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div className="timer-container">
      <h3>Rodada {currentRound}/5</h3>
      <div className="timer-display">
        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
}