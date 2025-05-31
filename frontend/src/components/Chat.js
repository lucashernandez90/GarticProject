import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const socket = io('http://localhost:3001');

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [roundEnded, setRoundEnded] = useState(false);
  const [isArtist, setIsArtist] = useState(false);

  useEffect(() => {
    const colors = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo'];
    const animals = ['Gato', 'Cachorro', 'Leão', 'Tigre', 'Panda'];
    const randomName = `${colors[Math.floor(Math.random() * colors.length)]} ${
      animals[Math.floor(Math.random() * animals.length)]
    }`;
    setPlayerName(randomName);
  }, []);

  const sendMessage = () => {
    if (message.trim() && !roundEnded && !isArtist) {
      socket.emit('enviar_palpite', message);
      setMessages([...messages, { text: message, sender: playerName, type: 'user' }]);
      setMessage('');
    }
  };

  useEffect(() => {
    socket.on('palpite_correto', ({ playerName }) => {
      setMessages(prev => [
        ...prev,
        { 
          text: `🎉 ${playerName} acertou!`,
          type: 'notification'
        }
      ]);
    });

    socket.on('round_end', ({ winner, word }) => {
      setRoundEnded(true);
      setMessages(prev => [
        ...prev,
        {
          text: `🏆 ${winner.name} ganhou a rodada! A palavra era: ${word}`,
          type: 'winner'
        }
      ]);
      setTimeout(() => setRoundEnded(false), 3000);
    });

    socket.on('set_artist', ({ isArtist }) => {
      setIsArtist(isArtist);
    });
    
    socket.on('new_artist', () => {
      setIsArtist(false);
    });

    return () => {
      socket.off('palpite_correto');
      socket.off('round_end');
      socket.off('set_artist');
      socket.off('new_artist');
    };
  }, []);

  return (
    <div className={`chat-container ${roundEnded ? 'chat-disabled' : ''}`}>
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            {msg.type === 'user' && <span className="sender">{msg.sender}: </span>}
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Digite seu palpite..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={roundEnded || isArtist}
        />
        <button onClick={sendMessage} disabled={roundEnded || isArtist}> 
          Enviar
        </button>
      </div>
    </div>
  );
}