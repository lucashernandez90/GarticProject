import React, { useEffect, useRef, useState } from 'react';
import './Canvas.css';
import ArtistInfo from './ArtistInfo';
import socket from '../socket'; // Usa o socket centralizado

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

  /**
   * Salva uma cópia do estado atual do canvas (para restaurar depois)
   */
  const saveCanvasSnapshot = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvasSnapshotRef.current = canvas.toDataURL();
    }
  };

  /**
   * Restaura o canvas a partir do último snapshot salvo
   */
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

  /**
   * Inicia o desenho quando o usuário pressiona o botão do mouse
   */
  const startDrawing = (e) => {
    if (!isArtist || e.button !== 0) return;

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

  /**
   * Desenha enquanto o usuário move o mouse
   */
  const draw = (e) => {
    if (!isDrawingRef.current || !isArtist) return;

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

    // Envia os pontos ao servidor periodicamente
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

  /**
   * Finaliza o desenho ao soltar o botão do mouse
   */
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

  /**
   * Alterna entre caneta e borracha
   */
  const handleToolChange = () => {
    setIsErasing((prev) => !prev);
  };

  /**
   * Limpa o canvas e notifica o servidor
   */
  const clearCanvas = () => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;

    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.emit('limpar_canvas');
  };

  /**
   * Configura o canvas inicialmente
   */
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

    // Debugging
    canvas.addEventListener('mousedown', (e) => console.log('Canvas mousedown', e));
    canvas.addEventListener('mousemove', (e) => console.log('Canvas mousemove', e));

    return () => {
      canvas.removeEventListener('mousedown', (e) => console.log('Canvas mousedown', e));
      canvas.removeEventListener('mousemove', (e) => console.log('Canvas mousemove', e));
    };
  }, []);

  /**
   * Listener para eventos do socket
   */
  useEffect(() => {
    const handleSetArtist = ({ word, isArtist }) => {
      console.log('SET_ARTIST EVENT RECEIVED:', { word, isArtist });
      setIsArtist(isArtist);
      setWordToDraw(word);

      if (isArtist) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.pointerEvents = 'auto';
          console.log('Canvas ativado para o novo artista');
        }
      }
    };

    const handleNewArtist = () => {
      setIsArtist(false);
      setWordToDraw('');
    };

    const handleUpdateDrawing = ({ points, color, size, isErasing }) => {
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
    };

    const handleClearCanvas = () => {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    socket.on('set_artist', handleSetArtist);
    socket.on('new_artist', handleNewArtist);
    socket.on('atualizar_desenho', handleUpdateDrawing);
    socket.on('canvas_limpo', handleClearCanvas);

    return () => {
      socket.off('set_artist', handleSetArtist);
      socket.off('new_artist', handleNewArtist);
      socket.off('atualizar_desenho', handleUpdateDrawing);
      socket.off('canvas_limpo', handleClearCanvas);
    };
  }, []);

  /**
   * Vincula/desvincula eventos do canvas dinamicamente
   */
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !isArtist) return;

    const onMouseDown = (e) => startDrawing(e);
    const onMouseMove = (e) => draw(e);
    const onMouseUp = () => stopDrawing();
    const onMouseLeave = () => stopDrawing();

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [isArtist]);

  return (
    <div className="canvas-container">
      <ArtistInfo isArtist={isArtist} wordToDraw={wordToDraw} />

      <canvas
        className="drawing-canvas"
        ref={canvasRef}
        style={{
          pointerEvents: isArtist ? 'auto' : 'none'
        }}
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