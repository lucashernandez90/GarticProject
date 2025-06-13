import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';
import socket from '../socket';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [playerName, setPlayerName] = useState('');
  const [roundEnded, setRoundEnded] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const messagesEndRef = useRef(null);

  // Gera um nome aleatório para o jogador
  useEffect(() => {
    const colors = ['Vermelho', 'Azul', 'Verde', 'Amarelo', 'Roxo'];
    const animals = ['Gato', 'Cachorro', 'Leão', 'Tigre', 'Panda'];
    const randomName = `${colors[Math.floor(Math.random() * colors.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
    setPlayerName(randomName);
  }, []);

  useEffect(() => {
    const handleRoomFull = () => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: "❌ A sala está cheia (máximo 5 jogadores)",
        type: 'error'
      }]);
    };

    socket.on('room_full', handleRoomFull);

    return () => {
      socket.off('room_full', handleRoomFull);
    };
  }, []);

  useEffect(() => {
    const handleRoomFull = () => {
      alert('A sala está cheia (máximo 5 jogadores)');
      window.location.reload(); // Ou redirecione para outra página
    };

    socket.on('room_full', handleRoomFull);

    return () => {
      socket.off('room_full', handleRoomFull);
    };
  }, []);

  // Rolagem automática para a última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Envia mensagem/palpite
  const sendMessage = () => {
    if (!message.trim() || isArtist || roundEnded) return;

    socket.emit('enviar_palpite', message);
    setMessages(prev => [...prev, {
      id: Date.now(),
      text: message,
      sender: playerName,
      type: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setMessage('');
  };

  // Verifica se a mensagem é duplicada
  const isDuplicateMessage = (newMessage) => {
    return messages.some(msg => 
      msg.text === newMessage.text && 
      msg.sender === newMessage.sender && 
      msg.type === newMessage.type
    );
  };

  // Configura os listeners do socket
  useEffect(() => {
    const handlePalpiteErrado = ({ playerName, guess }) => {
      if (!isDuplicateMessage({ text: guess, sender: playerName, type: 'user' })) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: guess,
          sender: playerName,
          type: 'user',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    };

    const handlePalpiteCorreto = ({ playerName }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `🎉 ${playerName} acertou!`,
        type: 'notification'
      }]);
    };

    const handleRoundEnd = ({ winner, word }) => {
      setRoundEnded(true);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: winner ? `🏆 ${winner.name} ganhou a rodada!` : `⏰ Tempo esgotado! A palavra era: ${word}`,
        type: 'winner'
      }]);
      
      setTimeout(() => {
        setRoundEnded(false);
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: `🔁 Iniciando próxima rodada...`,
          type: 'notification'
        }]);
      }, 5000);
    };

    const handleSetArtist = ({ isArtist }) => {
      setIsArtist(isArtist);
      if (isArtist) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          text: '🎨 Você é o artista! Desenhe a palavra secreta.',
          type: 'notification'
        }]);
      }
    };
    socket.on('set_artist', handleSetArtist);

    const handleGameOver = ({ scores }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: '🏁 JOGO ENCERRADO - Placar Final:',
        type: 'game-over'
      }]);
      
      scores.sort((a, b) => b.score - a.score).forEach(player => {
        setMessages(prev => [...prev, {
          id: Date.now() + Math.random(),
          text: `${player.name}: ${player.score} pontos`,
          type: 'score'
        }]);
      });
    };

    // Configura todos os listeners
    socket.on('palpite_errado', handlePalpiteErrado);
    socket.on('palpite_correto', handlePalpiteCorreto);
    socket.on('round_end', handleRoundEnd);
    socket.on('set_artist', handleSetArtist);
    socket.on('game_over', handleGameOver);

    // Limpeza dos listeners
    return () => {
      socket.off('palpite_errado', handlePalpiteErrado);
      socket.off('palpite_correto', handlePalpiteCorreto);
      socket.off('round_end', handleRoundEnd);
      socket.off('set_artist', handleSetArtist);
      socket.off('game_over', handleGameOver);
    };
  }, []);

  return (
    <div className={`chat-container ${roundEnded ? 'chat-disabled' : ''}`}>
      <div className="messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.type}`}>
            {msg.sender && <span className="sender">{msg.sender}: </span>}
            {msg.text}
            {msg.timestamp && <span className="timestamp">{msg.timestamp}</span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={isArtist ? 'Você é o artista' : roundEnded ? 'Rodada encerrada' : 'Digite seu palpite...'}
          disabled={isArtist || roundEnded}
        />
        <button
          onClick={sendMessage}
          disabled={isArtist || roundEnded || !message.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}