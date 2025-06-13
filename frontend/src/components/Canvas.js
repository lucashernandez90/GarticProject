import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Canvas.css';
import ArtistInfo from './ArtistInfo';
import socket from '../socket';

export default function Canvas() {
  // Refs
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const lastSendRef = useRef(Date.now());
  const accumulatedPointsRef = useRef([]);
  const canvasSnapshotRef = useRef(null);

  // States
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [wordToDraw, setWordToDraw] = useState('');
  const [gameStarted, setGameStarted] = useState(false);

  // Funções auxiliares
  const saveCanvasSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvasSnapshotRef.current = canvas.toDataURL();
    }
  };

  const restoreCanvasSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !canvasSnapshotRef.current) return;

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = canvasSnapshotRef.current;
  };

  const drawRemoteLine = (ctx, points, color, size, isErasing) => {
    if (!ctx || !Array.isArray(points) || points.length < 2) {
      console.warn('Dados de desenho inválidos:', { points });
      return;
    }

    try {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      
      ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < points.length; i++) {
        if (!points[i]) continue;
        ctx.lineTo(points[i].x, points[i].y);
      }

      ctx.stroke();
      ctx.closePath();
      ctx.restore();
    } catch (error) {
      console.error('Erro ao renderizar desenho remoto:', error);
    }
  };

  // Funções de desenho
  const startDrawing = (e) => {
    if (!isArtist || !gameStarted || e.button !== 0) return;

    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    saveCanvasSnapshot();

    ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = isErasing ? 20 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPositionRef.current = { x, y };
    accumulatedPointsRef.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !isArtist || !gameStarted) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    lastPositionRef.current = { x, y };
    accumulatedPointsRef.current.push({ x, y });

    if (Date.now() - lastSendRef.current > 30) {
      if (accumulatedPointsRef.current.length > 1) {
        socket.emit('desenhar', {
          type: 'segment',
          points: accumulatedPointsRef.current,
          isErasing,
          color: isErasing ? null : color,
          size: isErasing ? 20 : brushSize
        });
      }

      accumulatedPointsRef.current = [lastPositionRef.current];
      lastSendRef.current = Date.now();
    }
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;

    if (accumulatedPointsRef.current.length > 1) {
      socket.emit('desenhar', {
        type: 'segment',
        points: accumulatedPointsRef.current,
        isErasing,
        color: isErasing ? null : color,
        size: isErasing ? 20 : brushSize
      });
    }

    accumulatedPointsRef.current = [];
    saveCanvasSnapshot();
  };

  // Funções de controle
  const handleToolChange = () => {
    setIsErasing((prev) => !prev);
  };

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    socket.emit('limpar_canvas');
  };

  // Handlers de eventos Socket.IO
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    // Handlers definidos dentro do useEffect para evitar problemas de escopo
    const handleSetArtist = ({ word, isArtist: isPlayerArtist, isFirstRound }) => {
      console.log('set_artist recebido:', { word, isPlayerArtist });
      setIsArtist(isPlayerArtist);
      setWordToDraw(word);
      
      if (isPlayerArtist) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setGameStarted(true);
      }
    };

    const handleUpdateDrawing = (data) => {
      if (!isArtist) {
        drawRemoteLine(ctx, data.points, data.color, data.size, data.isErasing);
      }
    };

    const handleClearCanvas = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handlePlayerUpdate = ({ isArtist: isPlayerArtist }) => {
      setIsArtist(isPlayerArtist);
      if (isPlayerArtist) {
        setGameStarted(true);
      }
    };

    const handleGameStarted = () => {
      setGameStarted(true);
    };

    const handleNewRound = () => {
      socket.emit('request_artist_status');
    };

    // Configura listeners
    socket.on('set_artist', handleSetArtist);
    socket.on('atualizar_desenho', handleUpdateDrawing);
    socket.on('canvas_limpo', handleClearCanvas);
    socket.on('player_update', handlePlayerUpdate);
    socket.on('game_started', handleGameStarted);
    socket.on('new_round', handleNewRound);

    // Verificação inicial
    socket.emit('request_artist_status');

    return () => {
      socket.off('set_artist', handleSetArtist);
      socket.off('atualizar_desenho', handleUpdateDrawing);
      socket.off('canvas_limpo', handleClearCanvas);
      socket.off('player_update', handlePlayerUpdate);
      socket.off('game_started', handleGameStarted);
      socket.off('new_round', handleNewRound);
    };
  }, [isArtist]);

  // Efeito para eventos de mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e) => startDrawing(e);
    const onMouseMove = (e) => draw(e);
    const onMouseUp = () => stopDrawing();
    const onMouseLeave = () => stopDrawing();

    if (isArtist && gameStarted) {
      canvas.style.pointerEvents = 'auto';
      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('mouseleave', onMouseLeave);
    } else {
      canvas.style.pointerEvents = 'none';
    }

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isArtist, gameStarted, color, brushSize, isErasing]);

  useEffect(() => {
    console.log('Estado atual:', { isArtist, gameStarted, wordToDraw });
  }, [isArtist, gameStarted, wordToDraw]);

  return (
    <div className="canvas-container">
      <ArtistInfo isArtist={isArtist} wordToDraw={wordToDraw} />

      <canvas
        className="drawing-canvas"
        ref={canvasRef}
        style={{ pointerEvents: isArtist && gameStarted ? 'auto' : 'none' }}
      />

      {isArtist && gameStarted && (
        <div className="tools">
          <button onClick={handleToolChange} className="tool-button">
            {isErasing ? 'Caneta' : 'Borracha'}
          </button>
          <input
            type="color"
            disabled={isErasing}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-picker"
          />
          <div className="brush-size-container">
            <span>Tamanho:</span>
            <input
              type="range"
              min="1"
              max="30"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="brush-slider"
            />
            <span>{brushSize}px</span>
          </div>
          <button onClick={clearCanvas} className="clear-button">
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}