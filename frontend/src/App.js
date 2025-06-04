import React from 'react';
import io from 'socket.io-client'; // Adicione esta importação
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import Timer from './components/Timer';
import './App.css';

// Crie a conexão do socket fora do componente
const socket = io('http://localhost:3001');

function App() {
  const handleTimeEnd = () => {
    // Agora o socket está disponível
    socket.emit('time_ended');
  };

  return (
    <div className="app">
      <header>
        <h1>Pictionary Online</h1>
      </header>
      <main>
        <Canvas socket={socket} /> {/* Passe o socket como prop */}
        <div className="right-panel">
          <Timer duration={60} onTimeEnd={handleTimeEnd} />
          <Chat socket={socket} /> {/* Passe o socket como prop */}
        </div>
      </main>
    </div>
  );
}

export default App;