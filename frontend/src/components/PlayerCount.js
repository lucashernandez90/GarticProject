import React, { useEffect, useState } from 'react';
import socket from '../socket';

export default function PlayerCount() {
  const [count, setCount] = useState({ current: 0, max: 5 });

  useEffect(() => {
    const handlePlayerCount = (data) => {
      console.log('Atualizando contagem:', data);
      setCount(data);
    };

    socket.on('player_count', handlePlayerCount);

    socket.emit('get_player_count'); 
    
    const interval = setInterval(() => {
      socket.emit('get_player_count');
    }, 2000);

    return () => {
      socket.off('player_count', handlePlayerCount);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="player-count">
      Jogadores: {count.current}/{count.max}
    </div>
  );
}
