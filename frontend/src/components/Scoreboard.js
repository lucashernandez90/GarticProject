import React from 'react';

export default function Scoreboard({ players, scores, currentArtist }) {
  return (
    <div className="scoreboard">
      <h3>Placar</h3>
      <ul>
        {scores
          .sort((a, b) => b.score - a.score)
          .map(player => (
            <li
              key={player.playerId}
              className={player.playerId === currentArtist ? 'artist' : ''}
            >
              <span className="player-name">{player.playerName}</span>
              <span className="player-score">{player.score} pts</span>
              {player.playerId === currentArtist && (
                <span className="artist-badge">🎨</span>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
