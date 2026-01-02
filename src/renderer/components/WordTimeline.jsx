import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../store';

const FLAG_COLORS = {
  text_mismatch: '#f97316',
  timing_long: '#ef4444',
  timing_short: '#ef4444',
  overlap: '#a855f7',
  extra_word: '#eab308',
  clean: '#6b7280'
};

const FLAG_TOOLTIPS = {
  text_mismatch: 'Text mismatch: Word differs from lyrics',
  timing_long: 'Timing issue: Word duration too long',
  timing_short: 'Timing issue: Word duration too short',
  overlap: 'Overlap: This word overlaps with the next word',
  extra_word: 'Extra word: Not in original lyrics'
};

const TRACK_COLORS = ['#3b82f6', '#22c55e'];
const RESIZE_HANDLE_WIDTH = 8;
const RENDER_BUFFER = 200;

function WordTimeline({ onWordDoubleClick, onWordContextMenu }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    songData,
    wordFlags,
    wordTracks,
    zoom,
    setZoom,
    currentTime,
    duration,
    selectedWordIndices,
    selectWord,
    selectWordRange,
    setCurrentTime,
    updateWordNoHistory,
    finalizeDrag,
    pushHistory,
    timelineScrollLeft,
    setTimelineScrollLeft
  } = useStore();
  
  const effectiveDuration = songData?.duration || duration || 0;
  
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredWordIndex, setHoveredWordIndex] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('default');
  const [tooltip, setTooltip] = useState(null);
  
  const trackHeight = 100;
  const headerHeight = 20;
  const totalHeight = headerHeight + trackHeight * 2;
  
  const totalTimelineWidth = effectiveDuration > 0 
    ? Math.max(effectiveDuration * zoom, containerWidth)
    : containerWidth;

  // Calculate overlap layers for staggered display
  const overlapLayers = useMemo(() => {
    if (!songData?.word_timings) return {};
    const layers = {};
    const trackWords = [[], []]; 
    songData.word_timings.forEach((word, index) => {
      const track = wordTracks[index] || 0;
      trackWords[track].push({ ...word, index });
    });
    trackWords.forEach((words, track) => {
      const sorted = [...words].sort((a, b) => a.start - b.start);
      const layerEnds = []; 
      sorted.forEach(word => {
        let assignedLayer = 0;
        for (let i = 0; i < layerEnds.length; i++) {
          if (word.start >= layerEnds[i]) {
            assignedLayer = i;
            layerEnds[i] = word.end;
            break;
          }
          assignedLayer = i + 1;
        }
        if (assignedLayer >= layerEnds.length) {
          layerEnds.push(word.end);
        } else {
          layerEnds[assignedLayer] = word.end;
        }
        layers[word.index] = assignedLayer;
      });
    });
    return layers;
  }, [songData, wordTracks]);

  const maxLayersPerTrack = useMemo(() => {
    if (!songData?.word_timings) return [1, 1];
    const trackLayers = [0, 0];
    songData.word_timings.forEach((_, index) => {
      const track = wordTracks[index] || 0;
      const layer = overlapLayers[index] || 0;
      trackLayers[track] = Math.max(trackLayers[track], layer + 1);
    });
    return trackLayers;
  }, [songData, wordTracks, overlapLayers]);

  // Setup ResizeObserver
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

  // --- SYNCHRONIZATION FIX START ---

  // Sync scroll from container to store (User Scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only update store if difference is significant to break loop
      if (Math.abs(container.scrollLeft - timelineScrollLeft) > 2) {
        setTimelineScrollLeft(container.scrollLeft);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setTimelineScrollLeft, timelineScrollLeft]);

  // Sync scroll from store to container (Programmatic Scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    if (Math.abs(container.scrollLeft - timelineScrollLeft) > 2) {
      container.scrollLeft = timelineScrollLeft;
    }
  }, [timelineScrollLeft]);

  // Scroll to follow playhead (Auto-scroll)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    // Calculate Playhead Position
    const playheadX = currentTime * zoom;
    const cWidth = container.clientWidth;
    
    // Use the Store's value as the source of truth for "current scroll" during auto-scroll checks
    // This prevents reading a stale DOM value if the DOM is lagging behind the React state
    const currentScrollLeft = timelineScrollLeft;
    
    let targetScroll = null;

    if (playheadX < currentScrollLeft + 100) {
      targetScroll = Math.max(0, playheadX - 100);
    } else if (playheadX > currentScrollLeft + cWidth - 100) {
      targetScroll = playheadX - cWidth + 100;
    }

    // Update Store directly if we need to scroll
    if (targetScroll !== null && Math.abs(targetScroll - currentScrollLeft) > 2) {
      setTimelineScrollLeft(targetScroll);
    }
  }, [currentTime, zoom, timelineScrollLeft, setTimelineScrollLeft]);

  // --- SYNCHRONIZATION FIX END ---

  // Scroll wheel zoom handler
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setZoom(zoom + delta);
    }
  }, [zoom, setZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Get word at position with layer-aware hit testing
  const getWordAtPosition = useCallback((virtualX, y) => {
    if (!songData?.word_timings) return null;
    const time = virtualX / zoom;
    const trackIndex = Math.floor((y - headerHeight) / trackHeight);
    if (trackIndex < 0 || trackIndex > 1) return null;
    const maxLayers = maxLayersPerTrack[trackIndex];
    const layerHeight = (trackHeight - 10) / Math.max(maxLayers, 1);
    const relativeY = y - headerHeight - trackIndex * trackHeight;
    const matchingWords = [];
    for (let i = 0; i < songData.word_timings.length; i++) {
      const word = songData.word_timings[i];
      const track = wordTracks[i] || 0;
      if (track !== trackIndex) continue;
      if (time < word.start || time > word.end) continue;
      const layer = overlapLayers[i] || 0;
      const wordY = 5 + layer * layerHeight;
      const wordHeight = layerHeight - 4;
      if (relativeY >= wordY && relativeY <= wordY + wordHeight) {
        matchingWords.push({ index: i, layer });
      }
    }
    if (matchingWords.length > 0) {
      matchingWords.sort((a, b) => b.layer - a.layer);
      return matchingWords[0].index;
    }
    return null;
  }, [songData, wordTracks, zoom, overlapLayers, maxLayersPerTrack]);
  
  const getResizeHandleAtPosition = useCallback((virtualX, y) => {
    if (!songData?.word_timings) return null;
    const trackIndex = Math.floor((y - headerHeight) / trackHeight);
    if (trackIndex < 0 || trackIndex > 1) return null;
    const maxLayers = maxLayersPerTrack[trackIndex];
    const layerHeight = (trackHeight - 10) / Math.max(maxLayers, 1);
    const relativeY = y - headerHeight - trackIndex * trackHeight;
    for (let i = 0; i < songData.word_timings.length; i++) {
      const word = songData.word_timings[i];
      const track = wordTracks[i] || 0;
      if (track !== trackIndex) continue;
      const layer = overlapLayers[i] || 0;
      const wordY = 5 + layer * layerHeight;
      const wordHeight = layerHeight - 4;
      if (relativeY < wordY || relativeY > wordY + wordHeight) continue;
      const wordStartX = word.start * zoom;
      const wordEndX = word.end * zoom;
      if (virtualX >= wordStartX - RESIZE_HANDLE_WIDTH / 2 && virtualX <= wordStartX + RESIZE_HANDLE_WIDTH / 2) {
        return { wordIndex: i, edge: 'start' };
      }
      if (virtualX >= wordEndX - RESIZE_HANDLE_WIDTH / 2 && virtualX <= wordEndX + RESIZE_HANDLE_WIDTH / 2) {
        return { wordIndex: i, edge: 'end' };
      }
    }
    return null;
  }, [songData, wordTracks, zoom, overlapLayers, maxLayersPerTrack]);
  
  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasWidth = containerWidth;
    const scrollLeft = timelineScrollLeft;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${totalHeight}px`;
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
    
    const visibleStartX = scrollLeft - RENDER_BUFFER;
    const visibleEndX = scrollLeft + canvasWidth + RENDER_BUFFER;
    const visibleStartTime = Math.max(0, visibleStartX / zoom);
    const visibleEndTime = Math.min(effectiveDuration, visibleEndX / zoom);
    
    // Draw time ruler
    ctx.fillStyle = '#252545';
    ctx.fillRect(0, 0, canvasWidth, headerHeight);
    
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    
    const startTime = Math.floor(visibleStartTime / timeStep) * timeStep;
    for (let t = startTime; t <= visibleEndTime; t += timeStep) {
      const virtualX = t * zoom;
      const canvasX = virtualX - scrollLeft;
      
      if (canvasX >= -50 && canvasX <= canvasWidth + 50) {
        ctx.fillRect(canvasX, headerHeight - 5, 1, 5);
        ctx.fillText(`${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`, canvasX + 2, 12);
      }
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
    
    // Draw words with layer-aware positioning
    if (songData?.word_timings) {
      songData.word_timings.forEach((word, index) => {
        if (word.end < visibleStartTime || word.start > visibleEndTime) return;
        
        const track = wordTracks[index] || 0;
        const flags = wordFlags[index] || [];
        const isSelected = selectedWordIndices.includes(index);
        const isHovered = hoveredWordIndex === index;
        const layer = overlapLayers[index] || 0;
        
        const maxLayers = maxLayersPerTrack[track];
        const layerHeight = (trackHeight - 10) / Math.max(maxLayers, 1);
        
        const virtualX = word.start * zoom;
        const width = Math.max((word.end - word.start) * zoom, 20);
        const canvasX = virtualX - scrollLeft;
        const y = headerHeight + track * trackHeight + 5 + layer * layerHeight;
        const height = layerHeight - 4;
        
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
          if (ctx.roundRect) ctx.roundRect(canvasX, y, width, height, 4);
          else ctx.rect(canvasX, y, width, height);
          ctx.fill();
        } catch (e) {
          ctx.fillRect(canvasX, y, width, height);
        }
        
        if (isSelected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
        
        // Draw text if height allows
        if (height >= 14) {
          ctx.fillStyle = '#fff';
          ctx.font = `${Math.min(12, height - 4)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const textWidth = ctx.measureText(word.word).width;
          if (textWidth < width - 6) {
            ctx.fillText(word.word, canvasX + width / 2, y + height / 2);
          } else if (width > 20) {
            let truncated = word.word;
            while (ctx.measureText(truncated + '…').width > width - 6 && truncated.length > 1) {
              truncated = truncated.slice(0, -1);
            }
            ctx.fillText(truncated + '…', canvasX + width / 2, y + height / 2);
          }
        }
      });
    }
    
    // Draw playhead
    const playheadVirtualX = currentTime * zoom;
    const playheadCanvasX = playheadVirtualX - scrollLeft;
    
    if (playheadCanvasX >= -5 && playheadCanvasX <= canvasWidth + 5) {
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadCanvasX, 0);
      ctx.lineTo(playheadCanvasX, totalHeight);
      ctx.stroke();
    }
    
  }, [songData, wordFlags, wordTracks, zoom, effectiveDuration, containerWidth, timelineScrollLeft, selectedWordIndices, hoveredWordIndex, currentTime, overlapLayers, maxLayersPerTrack]);
  
  const canvasToVirtual = useCallback((canvasX) => {
    return canvasX + timelineScrollLeft;
  }, [timelineScrollLeft]);

  // Handle mouse events
  const handleMouseDown = useCallback((e) => {
    e.stopPropagation();
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const virtualX = canvasToVirtual(canvasX);
    
    const resizeHandle = getResizeHandleAtPosition(virtualX, y);
    if (resizeHandle && songData?.word_timings[resizeHandle.wordIndex]) {
      const word = songData.word_timings[resizeHandle.wordIndex];
      pushHistory();
      setDragState({
        type: `resize-${resizeHandle.edge}`,
        wordIndex: resizeHandle.wordIndex,
        initialTime: resizeHandle.edge === 'start' ? word.start : word.end,
        initialMouseX: virtualX
      });
      return;
    }
    
    const wordIndex = getWordAtPosition(virtualX, y);
    
    if (wordIndex !== null) {
      if (e.shiftKey && lastClickedIndex !== null) {
        e.preventDefault();
        selectWordRange(lastClickedIndex, wordIndex);
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        selectWord(wordIndex, true);
        setLastClickedIndex(wordIndex);
      } else {
        selectWord(wordIndex, false);
        setLastClickedIndex(wordIndex);
      }
    } else {
      const time = virtualX / zoom;
      setCurrentTime(Math.max(0, Math.min(time, effectiveDuration)));
    }
  }, [getWordAtPosition, getResizeHandleAtPosition, selectWord, selectWordRange, lastClickedIndex, zoom, effectiveDuration, setCurrentTime, songData, pushHistory, canvasToVirtual]);
  
  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const virtualX = canvasToVirtual(canvasX);
    
    if (dragState && (dragState.type === 'resize-start' || dragState.type === 'resize-end')) {
      const deltaX = virtualX - dragState.initialMouseX;
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
    
    const resizeHandle = getResizeHandleAtPosition(virtualX, y);
    if (resizeHandle) {
      setCursorStyle('ew-resize');
      setHoveredWordIndex(resizeHandle.wordIndex);
      updateTooltip(e, resizeHandle.wordIndex);
      return;
    }
    
    const wordIndex = getWordAtPosition(virtualX, y);
    setHoveredWordIndex(wordIndex);
    setCursorStyle(wordIndex !== null ? 'pointer' : 'default');
    
    if (wordIndex !== null) {
      updateTooltip(e, wordIndex);
    } else {
      setTooltip(null);
    }
  }, [getWordAtPosition, getResizeHandleAtPosition, dragState, zoom, songData, updateWordNoHistory, canvasToVirtual]);
  
  const updateTooltip = useCallback((e, wordIndex) => {
    const flags = wordFlags[wordIndex] || [];
    if (flags.length > 0) {
      const flagTypes = [...new Set(flags.map(f => f.type))];
      const tooltipText = flagTypes.map(type => FLAG_TOOLTIPS[type] || type).join('\n');
      setTooltip({
        x: e.clientX + 10,
        y: e.clientY + 10,
        text: tooltipText
      });
    } else {
      setTooltip(null);
    }
  }, [wordFlags]);
  
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
    setCursorStyle('default');
    setTooltip(null);
  }, []);
  
  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const virtualX = canvasToVirtual(canvasX);
    
    const wordIndex = getWordAtPosition(virtualX, y);
    if (wordIndex !== null && onWordDoubleClick) {
      onWordDoubleClick(wordIndex);
    }
  }, [getWordAtPosition, onWordDoubleClick, canvasToVirtual]);
  
  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const virtualX = canvasToVirtual(canvasX);
    
    const wordIndex = getWordAtPosition(virtualX, y);
    if (wordIndex !== null) {
      if (!selectedWordIndices.includes(wordIndex)) {
        selectWord(wordIndex, false);
      }
      if (onWordContextMenu) {
        onWordContextMenu(e, selectedWordIndices.includes(wordIndex) ? selectedWordIndices : [wordIndex]);
      }
    }
  }, [getWordAtPosition, selectedWordIndices, selectWord, onWordContextMenu, canvasToVirtual]);
  
  return (
    <div className="timeline-container">
      <div className="timeline-labels">
        <div className="track-label track-0">Lead</div>
        <div className="track-label track-1">Harmony</div>
      </div>
      <div 
        className="timeline-canvas-container" 
        ref={containerRef}
        style={{ height: totalHeight, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}
      >
        <div style={{ 
          width: totalTimelineWidth, 
          height: 1, 
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }} />
        <canvas
          ref={canvasRef}
          className="timeline-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          style={{ 
            cursor: cursorStyle,
            position: 'sticky',
            left: 0,
            top: 0
          }}
        />
      </div>
      {tooltip && (
        <div 
          className="word-tooltip"
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.9)',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'pre-line',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: '300px'
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

export default WordTimeline;
