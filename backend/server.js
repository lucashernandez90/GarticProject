const express = require('express');
const socketIO = require('socket.io');
const http = require('http');
const palavras = require('./palavras.json');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Estado do jogo melhorado
const gameState = {
  currentArtist: null,
  currentWord: '',
  players: new Map(),
  correctGuessers: new Set(),
  artistQueue: [],
  roundTimer: null,
  roundTime: 120000 // 2 minutos por rodada
};

function getRandomWord() {
  return palavras[Math.floor(Math.random() * palavras.length)];
}

function startNewRound() {
  // Limpa estado da rodada anterior
  gameState.correctGuessers.clear();
  gameState.currentWord = getRandomWord();
  
  // Encontra o próximo artista válido
  let nextArtist = null;
  while (gameState.artistQueue.length > 0 && !nextArtist) {
    const candidateId = gameState.artistQueue.shift();
    if (gameState.players.has(candidateId)) {
      nextArtist = candidateId;
    }
  }

  // Se não encontrou na fila, recria com jogadores ativos
  if (!nextArtist && gameState.players.size > 0) {
    gameState.artistQueue = Array.from(gameState.players.keys());
    nextArtist = gameState.artistQueue.shift();
  }

  // Se não há jogadores, encerra
  if (!nextArtist) {
    gameState.currentArtist = null;
    return;
  }

  gameState.currentArtist = nextArtist;
  const artistSocket = io.sockets.sockets.get(nextArtist);

  // Verifica se o socket ainda está conectado
  if (artistSocket && artistSocket.connected) {
    artistSocket.emit('set_artist', { 
      word: gameState.currentWord,
      isArtist: true
    });

    io.emit('new_artist', {
      artistId: gameState.currentArtist,
      artistName: gameState.players.get(gameState.currentArtist).name
    });

    // Inicia temporizador da rodada
    gameState.roundTimer = setTimeout(() => {
      endRound(null);
    }, gameState.roundTime);
  } else {
    // Se o artista não está mais conectado, tenta novamente
    gameState.players.delete(nextArtist);
    startNewRound();
  }
}

function endRound(winnerSocket) {
  if (gameState.roundTimer) {
    clearTimeout(gameState.roundTimer);
    gameState.roundTimer = null;
  }
  
  const winner = winnerSocket ? gameState.players.get(winnerSocket.id) : null;
  io.emit('round_end', {
    winner: winner,
    word: gameState.currentWord
  });

  // Espera 5 segundos antes de iniciar nova rodada
  setTimeout(startNewRound, 5000);
}

io.on('connection', (socket) => {
  if (gameState.players.size >= 5) {
    socket.emit('sala_cheia');
    socket.disconnect(true);
    return;
  }

  console.log('Novo jogador conectado:', socket.id);

  // Registra o novo jogador
  gameState.players.set(socket.id, {
    name: `Jogador ${Math.floor(Math.random() * 1000)}`,
    score: 0
  });

  // Adiciona à fila de artistas
  gameState.artistQueue.push(socket.id);

  // Inicia jogo se for o primeiro jogador
  if (gameState.players.size === 1) {
    startNewRound();
  }

  socket.on('desenhar', (data) => {
    if (socket.id === gameState.currentArtist) {
      socket.broadcast.emit('atualizar_desenho', data);
    }
  });

  socket.on('enviar_palpite', (palpite) => {
    if (socket.id === gameState.currentArtist) {
      socket.emit('erro', 'O artista não pode enviar palpites!');
      return;
    }

    if (palpite.toLowerCase() === gameState.currentWord.toLowerCase() && 
        !gameState.correctGuessers.has(socket.id)) {
      
      gameState.correctGuessers.add(socket.id);
      const player = gameState.players.get(socket.id);
      player.score += 10;

      io.emit('palpite_correto', {
        playerId: socket.id,
        playerName: player.name,
        score: player.score
      });

      // Verifica se todos acertaram (todos exceto o artista)
      if (gameState.correctGuessers.size === gameState.players.size - 1) {
        endRound(socket);
      }
    }
  });

  socket.on('disconnect', () => {
    const wasArtist = socket.id === gameState.currentArtist;
    gameState.players.delete(socket.id);
    
    // Remove da fila de artistas
    gameState.artistQueue = gameState.artistQueue.filter(id => id !== socket.id);

    if (wasArtist) {
      if (gameState.roundTimer) {
        clearTimeout(gameState.roundTimer);
        gameState.roundTimer = null;
      }
      startNewRound();
    }
  });
});

server.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});