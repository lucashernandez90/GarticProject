import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const socket = io('http://localhost:3001');

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [roundEnded, setRoundEnded] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const messagesEndRef = useRef(null);

  // Referência para o container de mensagens
  const messagesContainerRef = useRef(null);

  // Efeito para gerar nome aleatório do jogador
  useEffect(() => {
    const colors = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo'];
    const animals = ['Gato', 'Cachorro', 'Leão', 'Tigre', 'Panda'];
    const randomName = `${colors[Math.floor(Math.random() * colors.length)]} ${
      animals[Math.floor(Math.random() * animals.length)]
    }`;
    setPlayerName(randomName);
  }, []);

  // Função para rolar até o final do chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Efeito para rolar para baixo quando novas mensagens são adicionadas
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (message.trim() && !roundEnded && !isArtist) {
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
    }
  };

  // Configuração dos listeners do socket
  useEffect(() => {
    socket.on('palpite_correto', ({ playerName }) => {
      setMessages(prev => [
        ...prev,
        { 
          text: `🎉 ${playerName} acertou!`,
          type: 'notification',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    });

    socket.on('round_end', ({ winner, word }) => {
      setRoundEnded(true);
      setMessages(prev => [
        ...prev,
        {
          text: `🏆 ${winner ? winner.name + ' ganhou a rodada!' : 'Tempo esgotado!'} A palavra era: ${word}`,
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
            type: 'notification',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          type: 'notification',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    });

    return () => {
      socket.off('palpite_correto');
      socket.off('round_end');
      socket.off('set_artist');
      socket.off('new_artist');
    };
  }, [playerName]);

  return (
    <div className={`chat-container ${roundEnded ? 'chat-disabled' : ''}`}>
      <div className="messages" ref={messagesContainerRef}>
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
          placeholder={isArtist ? "Artista não pode palpitar" : "Digite seu palpite..."}
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