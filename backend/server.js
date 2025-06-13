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

// Configurações do jogo
const MAX_PLAYERS = 5;
const MIN_PLAYERS = 2;
const ROUND_TIME = 120000;
const MAX_ROUNDS = 5;
const DELAY_BETWEEN_ROUNDS = 5000;

// Estado do jogo
const gameState = {
  artist: null,
  potentialArtist: null, 
  currentWord: '',
  players: new Map(),
  correctGuessers: new Set(),
  roundTimer: null,
  roundsPlayed: 0,
  gameStarted: false,
  isWaiting: true,
  countdown: null
};

function getRandomWord() {
  return palavras[Math.floor(Math.random() * palavras.length)];
}

function updateAllPlayers() {
  io.emit('player_count', {
    current: gameState.players.size,
    max: MAX_PLAYERS
  });
  
  gameState.players.forEach((player, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('player_update', {
        isArtist: socketId === gameState.artist,
        currentRound: gameState.roundsPlayed + 1
      });
    }
  });
}

function startCountdown() {
  let count = 5;
  
  gameState.countdown = setInterval(() => {
    io.emit('countdown', { count });
    
    if (count <= 0) {
      clearInterval(gameState.countdown);
      // Define o artista oficialmente aqui
      gameState.artist = gameState.potentialArtist;
      gameState.players.get(gameState.artist).isArtist = true;
      gameState.gameStarted = true;
      io.emit('game_started'); 
      startNewRound();
      return;
    }
    
    count--;
  }, 1000);
}

function startNewRound() {
  if (gameState.roundsPlayed === 0) {
    // Primeira rodada - define o artista
    gameState.artist = gameState.potentialArtist;
    gameState.players.get(gameState.artist).isArtist = true;
    gameState.gameStarted = true;
    io.emit('game_started');
  }

  setTimeout(() => {
    _startRoundLogic();
  }, 500);
}

function _startRoundLogic() {
  if (gameState.roundsPlayed >= MAX_ROUNDS) {
    io.emit('game_over', { scores: Array.from(gameState.players.values()) });
    return;
  }

  gameState.correctGuessers.clear();
  gameState.currentWord = getRandomWord();
  gameState.isWaiting = false;
  
  const currentRound = gameState.roundsPlayed + 1;

  console.log('-----------------------------------');
  console.log(`INICIANDO RODADA ${currentRound}/${MAX_ROUNDS}`);
  console.log('ARTISTA:', gameState.artist);
  console.log('PALAVRA SORTEADA:', gameState.currentWord);
  console.log('-----------------------------------');

  io.emit('canvas_limpo');

  if (gameState.artist) {
    const artistSocket = io.sockets.sockets.get(gameState.artist);
    if (artistSocket) {
      artistSocket.emit('set_artist', {
        word: gameState.currentWord,
        isArtist: true,
        isFirstRound: gameState.roundsPlayed === 0
      });
      
      // Força uma atualização imediata
      artistSocket.emit('player_update', {
        isArtist: true,
        currentRound: gameState.roundsPlayed + 1
      });
    }
  }

  io.emit('new_round', {
    artistName: gameState.players.get(gameState.artist)?.name || 'Artista',
    currentRound: currentRound
  });

  io.emit('player_count', { 
    current: gameState.players.size,
    max: MAX_PLAYERS 
  });

  if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
  gameState.roundTimer = setTimeout(() => endRound(null), ROUND_TIME);
}

function endRound(winnerSocket) {
  clearTimeout(gameState.roundTimer);

  const winner = winnerSocket ? gameState.players.get(winnerSocket.id) : null;
  
  io.emit('round_end', {
    winner: winner,
    word: gameState.currentWord,
    roundsPlayed: gameState.roundsPlayed + 1,
    maxRounds: MAX_ROUNDS
  });

  console.log(`Rodada ${gameState.roundsPlayed + 1} encerrada. Palavra: ${gameState.currentWord}`);

  gameState.roundsPlayed++;

  if (gameState.roundsPlayed < MAX_ROUNDS) {
    setTimeout(startNewRound, DELAY_BETWEEN_ROUNDS);
  } else {
    io.emit('game_over', { 
      scores: Array.from(gameState.players.values()) 
    });
  }
}

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  if (gameState.players.size >= MAX_PLAYERS) {
    socket.emit('room_full');
    socket.disconnect();
    console.log(`Sala cheia. Conexão recusada para: ${socket.id}`);
    return;
  }

  // Marca o primeiro jogador como potencial artista
  if (gameState.players.size === 0) {
    gameState.potentialArtist = socket.id;
    console.log(`Potencial artista definido: ${socket.id}`);
  }

  gameState.players.set(socket.id, {
    name: `Jogador ${gameState.players.size + 1}`,
    score: 0,
    isArtist: false // Só será true quando o jogo começar
  });

  updateAllPlayers();

  if (gameState.isWaiting && gameState.players.size >= MIN_PLAYERS && !gameState.gameStarted) {
    console.log(`Jogadores suficientes (${gameState.players.size}). Iniciando contagem regressiva...`);
    clearInterval(gameState.countdown);
    startCountdown();
  } else if (gameState.isWaiting) {
    io.emit('waiting_players', {
      current: gameState.players.size,
      needed: MIN_PLAYERS
    });
  }

  socket.on('desenhar', (data) => {
    if (socket.id === gameState.artist) {
      console.log('Transmitindo desenho:', {
        points: data.points?.length,
        artist: socket.id,
        toPlayers: gameState.players.size - 1
      });
      
      // Transmite para TODOS os outros jogadores (broadcast)
      socket.broadcast.emit('atualizar_desenho', {
        points: data.points,
        color: data.color,
        size: data.size,
        isErasing: data.isErasing,
        timestamp: Date.now() // Para debug
      });
    }
  });

  socket.on('limpar_canvas', () => {
    if (socket.id === gameState.artist && gameState.gameStarted) {
      io.emit('canvas_limpo');
    }
  });

  socket.on('request_artist_status', () => {
    socket.emit('artist_status', {
      isArtist: socket.id === gameState.artist,
      word: gameState.currentWord
    });
  });

  socket.on('enviar_palpite', (palpite) => {
    const player = gameState.players.get(socket.id);

    if (socket.id === gameState.artist) {
      socket.emit('erro', 'Você é o artista e não pode palpitar!');
      return;
    }

    if (gameState.correctGuessers.has(socket.id)) return;

    if (palpite.toLowerCase() === gameState.currentWord.toLowerCase()) {
      gameState.correctGuessers.add(socket.id);
      player.score += 10;

      io.emit('palpite_correto', {
        playerId: socket.id,
        playerName: player.name,
        score: player.score
      });

      if (gameState.correctGuessers.size === gameState.players.size - 1) {
        endRound(socket);
      }
    } else {
      io.emit('palpite_errado', {
        playerName: player.name,
        guess: palpite
      });
    }
  });

  socket.on('disconnect', () => {
    const wasArtist = socket.id === gameState.artist;
    gameState.players.delete(socket.id);
    
    io.emit('player_count', { 
      current: gameState.players.size,
      max: MAX_PLAYERS 
    });

    if (wasArtist) {
      io.emit('artist_left');
      console.log('Artista saiu. Jogo encerrado.');
      if (gameState.roundTimer) clearTimeout(gameState.roundTimer);
      if (gameState.countdown) clearInterval(gameState.countdown);
    }
    
    if (gameState.players.size < MIN_PLAYERS && gameState.gameStarted) {
      gameState.isWaiting = true;
      io.emit('waiting_players', {
        current: gameState.players.size,
        needed: MIN_PLAYERS
      });
    }
  });
});

server.listen(3001, () => {
  console.log('Servidor rodando na porta 3001');
});