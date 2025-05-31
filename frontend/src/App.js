import React from 'react';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Timer from './components/Timer';
import './App.css';

function App() {
  return (
    <div className="app">
      <header>
        <h1>Pictionary Online</h1>
      </header>
      <main>
        <Canvas />
        <div className="right-panel">
          <Timer duration={60} />
          <Chat />
        </div>
      </main>
    </div>
  );
}

export default App;