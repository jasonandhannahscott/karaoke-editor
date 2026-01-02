import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

const FLAG_COLORS = {
  text_mismatch: '#f97316',
  timing_long: '#ef4444',
  timing_short: '#ef4444',
  overlap: '#a855f7',
  extra_word: '#eab308',
  clean: '#6b7280'
};

const TRACK_COLORS = ['#3b82f6', '#22c55e'];
const RESIZE_HANDLE_WIDTH = 8;

function WordTimeline({ onWordDoubleClick, onWordContextMenu }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    songData,
    wordFlags,
    wordTracks,
    zoom,
    currentTime,
    duration,
    selectedWordIndices,
    selectWord,
    selectWordRange,
    setCurrentTime,
    updateWordNoHistory,
    finalizeDrag,
    pushHistory
  } = useStore();
  
  const effectiveDuration = songData?.duration || duration || 0;
  
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredWordIndex, setHoveredWordIndex] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [resizeHover, setResizeHover] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('default');
  
  const trackHeight = 80;
  const headerHeight = 20;
  const totalHeight = headerHeight + trackHeight * 2;
  
  // Setup ResizeObserver to track container width safely
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect) {
          requestAnimationFrame(() => {
            setContainerWidth(entry.contentRect.width);
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate canvas width derived from state/props
  const canvasWidth = effectiveDuration > 0 
    ? Math.max(effectiveDuration * zoom, containerWidth)
    : containerWidth;

  // Calculate DPR
  const rawDpr = window.devicePixelRatio || 1;
  const maxCanvasPixels = 16000 * 16000;
  const proposedPixels = canvasWidth * rawDpr * totalHeight * rawDpr;
  const dpr = proposedPixels > maxCanvasPixels ? 1 : Math.min(rawDpr, 2);

  // Get word at position
  const getWordAtPosition = useCallback((x, y) => {
    if (!songData?.word_timings) return null;
    
    const time = x / zoom;
    const trackIndex = Math.floor((y - headerHeight) / trackHeight);
    
    if (trackIndex < 0 || trackIndex > 1) return null;
    
    for (let i = 0; i < songData.word_timings.length; i++) {
      const word = songData.word_timings[i];
      const track = wordTracks[i] || 0;
      
      if (track !== trackIndex) continue;
      
      if (time >= word.start && time <= word.end) {
        return i;
      }
    }
    
    return null;
  }, [songData, wordTracks, zoom]);
  
  // Get resize handle at position
  const getResizeHandleAtPosition = useCallback((x, y) => {
    if (!songData?.word_timings) return null;
    
    const trackIndex = Math.floor((y - headerHeight) / trackHeight);
    if (trackIndex < 0 || trackIndex > 1) return null;
    
    for (let i = 0; i < songData.word_timings.length; i++) {
      const word = songData.word_timings[i];
      const track = wordTracks[i] || 0;
      
      if (track !== trackIndex) continue;
      
      const wordStartX = word.start * zoom;
      const wordEndX = word.end * zoom;
      
      if (x >= wordStartX - RESIZE_HANDLE_WIDTH / 2 && x <= wordStartX + RESIZE_HANDLE_WIDTH / 2) {
        return { wordIndex: i, edge: 'start' };
      }
      
      if (x >= wordEndX - RESIZE_HANDLE_WIDTH / 2 && x <= wordEndX + RESIZE_HANDLE_WIDTH / 2) {
        return { wordIndex: i, edge: 'end' };
      }
    }
    
    return null;
  }, [songData, wordTracks, zoom]);
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !songData?.word_timings) return;
    
    if (canvasWidth < 10) return;
    
    const ctx = canvas.getContext('2d');
    
    // Scale for DPR
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);
    
    // Polyfill roundRect
    if (!ctx.roundRect) {
      ctx.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
      };
    }
    
    // Draw time ruler
    ctx.fillStyle = '#252545';
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    
    for (let t = 0; t <= effectiveDuration; t += timeStep) {
      const x = t * zoom;
      ctx.fillRect(x, headerHeight - 5, 1, 5);
      ctx.fillText(`${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`, x + 2, 12);
    }
    
    // Draw track backgrounds
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, headerHeight, canvasWidth, trackHeight);
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, headerHeight + trackHeight, canvasWidth, trackHeight);
    
    // Draw track divider
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, headerHeight + trackHeight);
    ctx.lineTo(canvasWidth, headerHeight + trackHeight);
    ctx.stroke();
    
    // Draw words
    songData.word_timings.forEach((word, index) => {
      const track = wordTracks[index] || 0;
      const flags = wordFlags[index] || [];
      const isSelected = selectedWordIndices.includes(index);
      const isHovered = hoveredWordIndex === index;
      
      const x = word.start * zoom;
      const width = Math.max((word.end - word.start) * zoom, 20);
      const y = headerHeight + track * trackHeight + 10;
      const height = trackHeight - 20;
      
      let bgColor = TRACK_COLORS[track];
      if (flags.length > 0) {
        if (flags.some(f => f.type === 'overlap')) bgColor = FLAG_COLORS.overlap;
        else if (flags.some(f => f.type.startsWith('timing'))) bgColor = FLAG_COLORS.timing_long;
        else if (flags.some(f => f.type === 'text_mismatch')) bgColor = FLAG_COLORS.text_mismatch;
        else if (flags.some(f => f.type === 'extra_word')) bgColor = FLAG_COLORS.extra_word;
      }
      
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = isSelected ? 1 : isHovered ? 0.9 : 0.7;
      
      try {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, width, height, 4);
        else ctx.rect(x, y, width, height);
        ctx.fill();
      } catch (e) {
        ctx.fillRect(x, y, width, height);
      }
      
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textWidth = ctx.measureText(word.word).width;
      if (textWidth < width - 6) {
        ctx.fillText(word.word, x + width / 2, y + height / 2);
      } else if (width > 20) {
        let truncated = word.word;
        while (ctx.measureText(truncated + '…').width > width - 6 && truncated.length > 1) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '…', x + width / 2, y + height / 2);
      }
    });
    
    // Draw playhead
    const playheadX = currentTime * zoom;
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, totalHeight);
    ctx.stroke();
    
  }, [songData, wordFlags, wordTracks, zoom, effectiveDuration, canvasWidth, selectedWordIndices, hoveredWordIndex, currentTime, dpr]);
  
  // Handle mouse events
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    const resizeHandle = getResizeHandleAtPosition(x, y);
    if (resizeHandle && songData?.word_timings[resizeHandle.wordIndex]) {
      const word = songData.word_timings[resizeHandle.wordIndex];
      pushHistory();
      setDragState({
        type: `resize-${resizeHandle.edge}`,
        wordIndex: resizeHandle.wordIndex,
        initialTime: resizeHandle.edge === 'start' ? word.start : word.end,
        initialMouseX: x
      });
      return;
    }
    
    const wordIndex = getWordAtPosition(x, y);
    
    if (wordIndex !== null) {
      if (e.shiftKey && lastClickedIndex !== null) {
        selectWordRange(lastClickedIndex, wordIndex);
      } else {
        selectWord(wordIndex, e.ctrlKey || e.metaKey);
        setLastClickedIndex(wordIndex);
      }
    } else {
      const time = x / zoom;
      setCurrentTime(Math.max(0, Math.min(time, effectiveDuration)));
    }
  }, [getWordAtPosition, getResizeHandleAtPosition, selectWord, selectWordRange, lastClickedIndex, zoom, effectiveDuration, setCurrentTime, songData, pushHistory]);
  
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    if (dragState && (dragState.type === 'resize-start' || dragState.type === 'resize-end')) {
      const deltaX = x - dragState.initialMouseX;
      const deltaTime = deltaX / zoom;
      const word = songData?.word_timings[dragState.wordIndex];
      
      if (word) {
        if (dragState.type === 'resize-start') {
          const newStart = Math.max(0, dragState.initialTime + deltaTime);
          if (word.end - newStart >= 0.03) {
            updateWordNoHistory(dragState.wordIndex, { start: newStart });
          }
        } else {
          const newEnd = Math.max(word.start + 0.03, dragState.initialTime + deltaTime);
          updateWordNoHistory(dragState.wordIndex, { end: newEnd });
        }
      }
      return;
    }
    
    const resizeHandle = getResizeHandleAtPosition(x, y);
    if (resizeHandle) {
      setResizeHover(resizeHandle);
      setCursorStyle('ew-resize');
      setHoveredWordIndex(resizeHandle.wordIndex);
      return;
    }
    
    setResizeHover(null);
    const wordIndex = getWordAtPosition(x, y);
    setHoveredWordIndex(wordIndex);
    setCursorStyle(wordIndex !== null ? 'pointer' : 'default');
  }, [getWordAtPosition, getResizeHandleAtPosition, dragState, zoom, songData, updateWordNoHistory]);
  
  const handleMouseUp = useCallback(() => {
    if (dragState && (dragState.type === 'resize-start' || dragState.type === 'resize-end')) {
      finalizeDrag();
    }
    setDragState(null);
  }, [dragState, finalizeDrag]);
  
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState) {
        handleMouseUp();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState, handleMouseUp]);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredWordIndex(null);
    setResizeHover(null);
    setCursorStyle('default');
  }, []);
  
  const handleDoubleClick = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    const wordIndex = getWordAtPosition(x, y);
    if (wordIndex !== null && onWordDoubleClick) {
      onWordDoubleClick(wordIndex);
    }
  }, [getWordAtPosition, onWordDoubleClick]);
  
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    const wordIndex = getWordAtPosition(x, y);
    if (wordIndex !== null) {
      if (!selectedWordIndices.includes(wordIndex)) {
        selectWord(wordIndex, false);
      }
      if (onWordContextMenu) {
        onWordContextMenu(e, selectedWordIndices.includes(wordIndex) ? selectedWordIndices : [wordIndex]);
      }
    }
  }, [getWordAtPosition, selectedWordIndices, selectWord, onWordContextMenu]);
  
  // Scroll to follow playhead
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const playheadX = currentTime * zoom;
    const cWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    
    if (playheadX < scrollLeft + 100) {
      container.scrollLeft = Math.max(0, playheadX - 100);
    } else if (playheadX > scrollLeft + cWidth - 100) {
      container.scrollLeft = playheadX - cWidth + 100;
    }
  }, [currentTime, zoom]);
  
  return (
    <div className="timeline-container">
      <div className="timeline-labels">
        <div className="track-label track-0">Lead</div>
        <div className="track-label track-1">Harmony</div>
      </div>
      <div 
        className="timeline-canvas-container" 
        ref={containerRef}
        style={{ height: totalHeight }}
      >
        <canvas
          ref={canvasRef}
          className="timeline-canvas"
          width={canvasWidth * dpr}
          height={totalHeight * dpr}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ 
            cursor: cursorStyle,
            width: canvasWidth,
            height: totalHeight
          }}
        />
      </div>
    </div>
  );
}

export default WordTimeline;
