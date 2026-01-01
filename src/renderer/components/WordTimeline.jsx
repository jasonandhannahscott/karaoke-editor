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

function WordTimeline({ onWordDoubleClick, onWordContextMenu }) {
  console.log('WordTimeline rendering');
  
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
    setCurrentTime
  } = useStore();
  
  // Use songData.duration if available, fallback to store duration
  const effectiveDuration = songData?.duration || duration || 0;
  console.log('WordTimeline effectiveDuration:', effectiveDuration, 'from songData:', songData?.duration, 'from store:', duration);
  
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [hoveredWordIndex, setHoveredWordIndex] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  
  const trackHeight = 80;
  const headerHeight = 20;
  const totalHeight = headerHeight + trackHeight * 2;
  
  // Calculate canvas width based on duration and zoom
  useEffect(() => {
    if (effectiveDuration > 0) {
      setCanvasWidth(Math.max(effectiveDuration * zoom, containerRef.current?.clientWidth || 800));
    } else {
      // Default width when duration unknown
      setCanvasWidth(containerRef.current?.clientWidth || 800);
    }
  }, [effectiveDuration, zoom]);
  
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
  
  // Draw canvas
  useEffect(() => {
    console.log('WordTimeline draw useEffect running');
    console.log('WordTimeline draw: effectiveDuration=', effectiveDuration, 'zoom=', zoom);
    const canvas = canvasRef.current;
    if (!canvas || !songData?.word_timings) {
      console.log('WordTimeline draw early return');
      return;
    }
    
    // Calculate canvas width directly
    const calculatedWidth = effectiveDuration > 0 
      ? Math.max(effectiveDuration * zoom, containerRef.current?.clientWidth || 800)
      : (containerRef.current?.clientWidth || 800);
    console.log('WordTimeline draw: calculatedWidth=', calculatedWidth);
    
    if (calculatedWidth < 10) {
      console.log('WordTimeline: canvas width too small, skipping draw');
      return;
    }
    
    // Update state for scroll sync
    if (calculatedWidth !== canvasWidth) {
      setCanvasWidth(calculatedWidth);
    }
    
    console.log('WordTimeline drawing', songData.word_timings.length, 'words');
    const ctx = canvas.getContext('2d');
    
    // Limit DPR for large canvases to avoid memory issues
    const rawDpr = window.devicePixelRatio || 1;
    const maxCanvasPixels = 16000 * 16000; // Max ~1GB
    const proposedPixels = calculatedWidth * rawDpr * totalHeight * rawDpr;
    const dpr = proposedPixels > maxCanvasPixels ? 1 : Math.min(rawDpr, 2);
    
    console.log('WordTimeline: setting canvas size', calculatedWidth, 'x', totalHeight, 'dpr:', dpr);
    // Set canvas size
    canvas.width = calculatedWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${calculatedWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    
    console.log('WordTimeline: clearing canvas');
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, calculatedWidth, totalHeight);
    
    // Polyfill for roundRect if not available
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
    
    console.log('WordTimeline: drawing time ruler');
    
    // Draw time ruler
    ctx.fillStyle = '#252545';
    ctx.fillRect(0, 0, calculatedWidth, headerHeight);
    
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    
    for (let t = 0; t <= effectiveDuration; t += timeStep) {
      const x = t * zoom;
      ctx.fillRect(x, headerHeight - 5, 1, 5);
      ctx.fillText(`${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`, x + 2, 12);
    }
    
    console.log('WordTimeline: drawing track backgrounds');
    
    // Draw track backgrounds
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, headerHeight, calculatedWidth, trackHeight);
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, headerHeight + trackHeight, calculatedWidth, trackHeight);
    
    // Draw track divider
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, headerHeight + trackHeight);
    ctx.lineTo(calculatedWidth, headerHeight + trackHeight);
    ctx.stroke();
    
    console.log('WordTimeline: grouping words');
    
    // Group words that overlap visually at current zoom
    const wordGroups = [];
    let currentGroup = null;
    
    songData.word_timings.forEach((word, index) => {
      const track = wordTracks[index] || 0;
      const x = word.start * zoom;
      const width = Math.max((word.end - word.start) * zoom, 20);
      const textWidth = ctx.measureText(word.word).width + 10;
      
      // Check if this word fits in its space
      const fitsInSpace = textWidth <= width;
      
      if (!currentGroup || track !== currentGroup.track || x > currentGroup.endX + 5 || fitsInSpace !== currentGroup.fitsInSpace) {
        // Start new group
        if (currentGroup) {
          wordGroups.push(currentGroup);
        }
        currentGroup = {
          indices: [index],
          track,
          startX: x,
          endX: x + width,
          fitsInSpace,
          words: [word]
        };
      } else {
        // Add to current group
        currentGroup.indices.push(index);
        currentGroup.endX = x + width;
        currentGroup.words.push(word);
      }
    });
    
    if (currentGroup) {
      wordGroups.push(currentGroup);
    }
    
    console.log('WordTimeline: drawing', songData.word_timings.length, 'word blocks');
    
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
      
      // Determine color based on flags
      let bgColor = TRACK_COLORS[track];
      if (flags.length > 0) {
        // Use the most severe flag color
        if (flags.some(f => f.type === 'overlap')) bgColor = FLAG_COLORS.overlap;
        else if (flags.some(f => f.type.startsWith('timing'))) bgColor = FLAG_COLORS.timing_long;
        else if (flags.some(f => f.type === 'text_mismatch')) bgColor = FLAG_COLORS.text_mismatch;
        else if (flags.some(f => f.type === 'extra_word')) bgColor = FLAG_COLORS.extra_word;
      }
      
      // Draw word block (use fillRect as fallback if roundRect fails)
      ctx.fillStyle = bgColor;
      ctx.globalAlpha = isSelected ? 1 : isHovered ? 0.9 : 0.7;
      
      try {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, width, height, 4);
        } else {
          // Fallback: draw rounded rectangle manually
          const r = 4;
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + width - r, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + r);
          ctx.lineTo(x + width, y + height - r);
          ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
          ctx.lineTo(x + r, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        }
        ctx.fill();
      } catch (e) {
        // Ultimate fallback: just use fillRect
        ctx.fillRect(x, y, width, height);
      }
      
      // Draw selection border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
      
      // Draw word text
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const textWidth = ctx.measureText(word.word).width;
      if (textWidth < width - 6) {
        ctx.fillText(word.word, x + width / 2, y + height / 2);
      } else if (width > 20) {
        // Truncate text
        let truncated = word.word;
        while (ctx.measureText(truncated + '…').width > width - 6 && truncated.length > 1) {
          truncated = truncated.slice(0, -1);
        }
        ctx.fillText(truncated + '…', x + width / 2, y + height / 2);
      }
    });
    
    console.log('WordTimeline: drawing playhead');
    
    // Draw playhead
    const playheadX = currentTime * zoom;
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, totalHeight);
    ctx.stroke();
    
    console.log('WordTimeline: draw complete');
    
  }, [songData, wordFlags, wordTracks, zoom, effectiveDuration, canvasWidth, selectedWordIndices, hoveredWordIndex, currentTime]);
  
  // Handle mouse events
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    const wordIndex = getWordAtPosition(x, y);
    
    if (wordIndex !== null) {
      if (e.shiftKey && lastClickedIndex !== null) {
        selectWordRange(lastClickedIndex, wordIndex);
      } else {
        selectWord(wordIndex, e.ctrlKey || e.metaKey);
        setLastClickedIndex(wordIndex);
      }
    } else {
      // Click on empty space - seek
      const time = x / zoom;
      setCurrentTime(Math.max(0, Math.min(time, effectiveDuration)));
    }
  }, [getWordAtPosition, selectWord, selectWordRange, lastClickedIndex, zoom, effectiveDuration, setCurrentTime]);
  
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top;
    
    const wordIndex = getWordAtPosition(x, y);
    setHoveredWordIndex(wordIndex);
  }, [getWordAtPosition]);
  
  const handleMouseLeave = useCallback(() => {
    setHoveredWordIndex(null);
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
      // If right-clicked word is not in selection, select it
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
    const containerWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    
    // If playhead is near edge, scroll
    if (playheadX < scrollLeft + 100) {
      container.scrollLeft = Math.max(0, playheadX - 100);
    } else if (playheadX > scrollLeft + containerWidth - 100) {
      container.scrollLeft = playheadX - containerWidth + 100;
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
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ cursor: hoveredWordIndex !== null ? 'pointer' : 'default' }}
        />
      </div>
    </div>
  );
}

export default WordTimeline;
