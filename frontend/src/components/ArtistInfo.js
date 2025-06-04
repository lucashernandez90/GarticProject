import React from 'react';

export default function ArtistInfo({ isArtist, wordToDraw }) {
  if (!isArtist) return null;

  return (
    <div className="artist-panel">
      <h3>Você é o desenhista!</h3>
      <div className="word-display">
        <strong>Palavra:</strong> {wordToDraw}
      </div>
      <p>Desenhe para os outros adivinharem</p>
    </div>
  );
}