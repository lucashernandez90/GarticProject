import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';
import socket from '../socket';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [roundEnded, setRoundEnded] = useState(false);
  const [isArtist, setIsArtist] = useState(false); // Controle do artista

  const messagesEndRef = useRef(null);

  // Gera nome aleatório ao entrar
  useEffect(() => {
    const colors = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo'];
    const animals = ['Gato', 'Cachorro', 'Leão', 'Tigre', 'Panda'];
    const randomName = `${colors[Math.floor(Math.random() * colors.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
    setPlayerName(randomName);
  }, []);

  // Scroll automático
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Envia palpite (apenas se NÃO for artista)
  const sendMessage = () => {
    if (!message.trim()) return;
    if (isArtist || roundEnded) return;

    socket.emit('enviar_palpite', message);
    setMessages(prev => [
      ...prev,
      {
        text: message,
        sender: playerName,
        type: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setMessage('');
  };

  // Listeners dos eventos do jogo
  useEffect(() => {
    socket.on('palpite_errado', ({ playerName, guess }) => {
      setMessages(prev => [
        ...prev,
        { 
          text: guess,
          sender: playerName,
          type: 'user' // ou 'other' se quiser diferenciar depois
        }
      ]);
    });

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
          text: `🏆 ${winner ? winner.name + ' ganhou a rodada!' : 'Tempo esgotado! A palavra era: ' + word}`,
          type: 'winner',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setTimeout(() => setRoundEnded(false), 3000);
    });

    socket.on('set_artist', ({ isArtist }) => {
      setIsArtist(isArtist);
      if (isArtist) {
        setMessages(prev => [
          ...prev,
          {
            text: 'Você é o artista agora! Desenhe a palavra secreta.',
            type: 'notification'
          }
        ]);
      }
    });

    socket.on('new_artist', ({ artistName }) => {
      setIsArtist(false);
      setMessages(prev => [
        ...prev,
        {
          text: `🎨 ${artistName} é o novo artista!`,
          type: 'notification'
        }
      ]);
    });

    return () => {
      socket.off('palpite_correto');
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
            {msg.sender && <span className="sender">{msg.sender}: </span>}
            {msg.text}
            {msg.timestamp && <span className="timestamp">{msg.timestamp}</span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={isArtist ? 'Artista não pode palpitar' : 'Digite seu palpite...'}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={roundEnded || isArtist}
        />
        <button
          onClick={sendMessage}
          disabled={roundEnded || isArtist || !message.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}