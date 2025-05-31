import React, { useState, useEffect } from 'react';
import './Timer.css';

export default function Timer({ duration }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div className="timer-container">
      <h3>Tempo Restante</h3>
      <div className="timer-display">
        {timeLeft}s
      </div>
      {timeLeft === 0 && <div className="time-up">Tempo esgotado!</div>}
    </div>
  );
}