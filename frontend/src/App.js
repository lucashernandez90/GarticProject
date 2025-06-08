import React from 'react';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Timer from './components/Timer';
import './App.css';
import socket from './socket'; // Socket centralizado

function App() {
  const handleTimeEnd = () => {
    socket.emit('time_ended');
  };

  return (
    <div className="app">
      <header>
        <h1>Pictionary Online</h1>
      </header>
      <main>
        <Canvas />
        <div className="right-panel">
          <Timer duration={60} onTimeEnd={handleTimeEnd} />
          <Chat />
        </div>
      </main>
    </div>
  );
}

export default App;