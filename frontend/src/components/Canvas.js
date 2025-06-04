import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import './Canvas.css';
import ArtistInfo from './ArtistInfo';

const socket = io('http://localhost:3001');

export default function Canvas() {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const lastSendRef = useRef(Date.now());
  const accumulatedPointsRef = useRef([]);
  const canvasSnapshotRef = useRef(null);

  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [isErasing, setIsErasing] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [wordToDraw, setWordToDraw] = useState('');

  // Salva estado atual do canvas
  const saveCanvasSnapshot = () => {
    const canvas = canvasRef.current;
    canvasSnapshotRef.current = canvas.toDataURL();
  };

  // Restaura canvas a partir do snapshot
  const restoreCanvasSnapshot = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = canvasSnapshotRef.current;
  };

  const startDrawing = (e) => {
    if (!isArtist || e.button !== 0) return;

    if (e.button !== 0) {
      console.log('Apenas botão esquerdo do mouse permitido');
      return;
    } 
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    console.log('Start drawing at', { x, y }); // Debug

    saveCanvasSnapshot();

    if (isErasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineWidth = isErasing ? 20 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    lastPositionRef.current = { x, y };
    accumulatedPointsRef.current = [{ x, y }];
  };

  const draw = (e) => {
    if (!isDrawingRef.current || !isArtist) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
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

  const handleToolChange = () => {
    setIsErasing(prev => !prev);
  };

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('limpar_canvas');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 600;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    canvas.addEventListener('mousedown', (e) => console.log('Canvas mousedown', e));
    canvas.addEventListener('mousemove', (e) => console.log('Canvas mousemove', e));
  }, []);

  useEffect(() => {
    socket.on('sala_cheia', () => {
      alert('A sala já está cheia! Tente novamente mais tarde.');
    });

    return () => {
      socket.off('sala_cheia');
    };
  }, []);


  useEffect(() => {
    socket.on('set_artist', ({ word, isArtist }) => {
      console.log('SET_ARTIST EVENT RECEIVED', { word, isArtist }); // Debug
      setIsArtist(isArtist);
      setWordToDraw(word);
      
      if (isArtist) {
        console.log('Agora você é o artista! Palavra:', word);
        // Habilita o canvas para desenho
        const canvas = canvasRef.current;
        canvas.style.pointerEvents = 'auto';
      }
    });

    socket.on('connect', () => {
      console.log('Conectado ao servidor com ID:', socket.id);
   });

    socket.on('new_artist', () => {
      setIsArtist(false);
      setWordToDraw('');
    });

    socket.on('atualizar_desenho', ({ points, color, size, isErasing }) => {
      const ctx = ctxRef.current;
      if (!ctx || points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
      ctx.strokeStyle = isErasing ? 'rgba(0,0,0,1)' : color;
      ctx.lineWidth = size;

      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }

      ctx.stroke();
    });

    socket.on('canvas_limpo', () => {
      const ctx = ctxRef.current;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    });

    return () => {
      socket.off('set_artist');
      socket.off('new_artist');
      socket.off('atualizar_desenho');
      socket.off('canvas_limpo');
    };
  }, []);

return (
  <div className="canvas-container">
    <ArtistInfo isArtist={isArtist} wordToDraw={wordToDraw} />
    
    <canvas
      className="drawing-canvas"
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />

    {isArtist && (
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