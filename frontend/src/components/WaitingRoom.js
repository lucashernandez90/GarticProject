import React, { useEffect, useState } from 'react';
import socket from '../socket';
import './WaitingRoom.css';

export default function WaitingRoom({ onGameStart }) {
  const [playerCount, setPlayerCount] = useState({ current: 1, needed: 2 });
  const [artistName, setArtistName] = useState('');

  useEffect(() => {
    socket.on('waiting_players', (data) => {
      setPlayerCount(data);
    });

    socket.on('new_round', ({ artistName }) => {
      setArtistName(artistName);
      onGameStart();
    });

    return () => {
      socket.off('waiting_players');
      socket.off('new_round');
    };
  }, [onGameStart]);

  return (
    <div className="waiting-room">
      <div className="loading-container">
        <h2>🕒 Sala de Espera</h2>
        
        <div className="loader">
          <div className="spinner"></div>
          <p>Aguardando jogadores...</p>
        </div>

        <div className="player-count">
          {playerCount.current}/{playerCount.needed} jogadores conectados
        </div>

        {artistName && (
          <div className="artist-info">
            Artista desta partida: <span>{artistName}</span>
          </div>
        )}

        <div className="game-rules">
          <h3>Como jogar:</h3>
          <ul>
            <li>1. O artista desenha a palavra secreta</li>
            <li>2. Os outros jogadores tentam adivinhar</li>
            <li>3. Cada acerto vale 10 pontos</li>
            <li>4. Partida com 5 rodadas</li>
          </ul>
        </div>
      </div>
    </div>
  );
}