import React, { useState } from 'react';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Timer from './components/Timer';
import PlayerCount from './components/PlayerCount';
import WaitingRoom from './components/WaitingRoom';
import './App.css';

function App() {
  const [gameStarted, setGameStarted] = useState(false);

  return (
    <div className="app">
      {!gameStarted ? (
        <WaitingRoom onGameStart={() => setGameStarted(true)} />
      ) : (
        <>
          <header>
            <h1>Pictionary</h1>
            <PlayerCount />
          </header>
          <main>
            <Canvas />
            <div className="right-panel">
              <Timer />
              <Chat />
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;