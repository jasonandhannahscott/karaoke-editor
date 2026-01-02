import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

// Generate note names for all 88 piano keys (A0 to C8)
const generateNoteNames = () => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteNames = [];
  
  for (let midi = 21; midi <= 108; midi++) {
    const octave = Math.floor((midi - 12) / 12);
    const noteIndex = midi % 12;
    noteNames.push({
      midi,
      name: notes[noteIndex] + octave,
      isBlack: [1, 3, 6, 8, 10].includes(noteIndex)
    });
  }
  
  return noteNames.reverse();
};

const NOTES = generateNoteNames();
const NOTE_HEIGHT = 12;
const TOTAL_HEIGHT = NOTES.length * NOTE_HEIGHT;
const RENDER_BUFFER = 200;

function PitchEditor() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const keyboardRef = useRef(null);
  
  const {
    songData,
    zoom,
    setZoom,
    currentTime,
    duration,
    selectedPitchRange,
    setSelectedPitchRange,
    setPitchForRange,
    clearPitchForRange,
    setCurrentTime,
    timelineScrollLeft,
    setTimelineScrollLeft
  } = useStore();
  
  const effectiveDuration = songData?.duration || duration || 0;
  
  const [containerWidth, setContainerWidth] = useState(800);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [hoveredNote, setHoveredNote] = useState(null);
  
  const totalTimelineWidth = effectiveDuration > 0 
    ? Math.max(effectiveDuration * zoom, containerWidth)
    : containerWidth;

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

  // Sync scroll from container to store
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setTimelineScrollLeft(container.scrollLeft);
      // Sync keyboard scroll
      if (keyboardRef.current) {
        keyboardRef.current.scrollTop = container.scrollTop;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setTimelineScrollLeft]);

  // Sync scroll from store to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    if (Math.abs(container.scrollLeft - timelineScrollLeft) > 1) {
      container.scrollLeft = timelineScrollLeft;
    }
  }, [timelineScrollLeft]);

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
  
  // Draw piano roll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasWidth = containerWidth;
    const scrollLeft = timelineScrollLeft;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = TOTAL_HEIGHT * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, TOTAL_HEIGHT);
    
    const visibleStartX = scrollLeft - RENDER_BUFFER;
    const visibleEndX = scrollLeft + canvasWidth + RENDER_BUFFER;
    const visibleStartTime = Math.max(0, visibleStartX / zoom);
    const visibleEndTime = Math.min(effectiveDuration, visibleEndX / zoom);
    
    // Draw note rows
    NOTES.forEach((note, index) => {
      const y = index * NOTE_HEIGHT;
      
      ctx.fillStyle = note.isBlack ? '#16213e' : '#1a1a2e';
      ctx.fillRect(0, y, canvasWidth, NOTE_HEIGHT);
      
      ctx.strokeStyle = '#252545';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    });
    
    // Draw visible vertical time lines
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.strokeStyle = '#333';
    
    const startTime = Math.floor(visibleStartTime / timeStep) * timeStep;
    for (let t = startTime; t <= visibleEndTime; t += timeStep) {
      const virtualX = t * zoom;
      const canvasX = virtualX - scrollLeft;
      
      if (canvasX >= -10 && canvasX <= canvasWidth + 10) {
        ctx.beginPath();
        ctx.moveTo(canvasX, 0);
        ctx.lineTo(canvasX, TOTAL_HEIGHT);
        ctx.stroke();
      }
    }
    
    // Draw visible pitch data
    if (songData?.pitch_data) {
      songData.pitch_data.forEach((point) => {
        if (point.midi_note === null) return;
        if (point.time < visibleStartTime || point.time > visibleEndTime) return;
        
        const virtualX = point.time * zoom;
        const canvasX = virtualX - scrollLeft;
        const noteIndex = NOTES.findIndex(n => n.midi === point.midi_note);
        
        if (noteIndex >= 0) {
          const y = noteIndex * NOTE_HEIGHT;
          
          if (selectedPitchRange && 
              point.time >= selectedPitchRange.start && 
              point.time <= selectedPitchRange.end) {
            ctx.fillStyle = '#ff9800';
          } else {
            ctx.fillStyle = '#e94560';
          }
          
          ctx.fillRect(canvasX, y + 2, zoom * 0.01, NOTE_HEIGHT - 4);
        }
      });
    }
    
    // Draw selection box
    if (isSelecting && selectionStart !== null && selectionEnd !== null) {
      const startCanvasX = selectionStart.x - scrollLeft;
      const endCanvasX = selectionEnd.x - scrollLeft;
      
      const startX = Math.min(startCanvasX, endCanvasX);
      const endX = Math.max(startCanvasX, endCanvasX);
      const startY = Math.min(selectionStart.y, selectionEnd.y);
      const endY = Math.max(selectionStart.y, selectionEnd.y);
      
      ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
      ctx.fillRect(startX, startY, endX - startX, endY - startY);
      
      ctx.strokeStyle = '#e94560';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      ctx.setLineDash([]);
    }
    
    // Draw playhead
    const playheadVirtualX = currentTime * zoom;
    const playheadCanvasX = playheadVirtualX - scrollLeft;
    
    if (playheadCanvasX >= -5 && playheadCanvasX <= canvasWidth + 5) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playheadCanvasX, 0);
      ctx.lineTo(playheadCanvasX, TOTAL_HEIGHT);
      ctx.stroke();
    }
    
  }, [songData, zoom, effectiveDuration, containerWidth, timelineScrollLeft, currentTime, selectedPitchRange, isSelecting, selectionStart, selectionEnd]);
  
  const canvasToVirtual = useCallback((canvasX) => {
    return canvasX + timelineScrollLeft;
  }, [timelineScrollLeft]);

  // Handle mouse events for selection
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;
    const virtualX = canvasToVirtual(canvasX);
    
    setIsSelecting(true);
    setSelectionStart({ x: virtualX, y });
    setSelectionEnd({ x: virtualX, y });
  }, [canvasToVirtual]);
  
  const handleMouseMove = useCallback((e) => {
    if (!isSelecting) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;
    const virtualX = canvasToVirtual(canvasX);
    
    setSelectionEnd({ x: virtualX, y });
  }, [isSelecting, canvasToVirtual]);
  
  const handleMouseUp = useCallback((e) => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      return;
    }
    
    const startX = Math.min(selectionStart.x, selectionEnd.x);
    const endX = Math.max(selectionStart.x, selectionEnd.x);
    
    const startTime = startX / zoom;
    const endTime = endX / zoom;
    
    if (endTime - startTime > 0.05) {
      setSelectedPitchRange({ start: startTime, end: endTime });
    } else {
      setSelectedPitchRange(null);
      setCurrentTime(startTime);
    }
    
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  }, [isSelecting, selectionStart, selectionEnd, zoom, setSelectedPitchRange, setCurrentTime]);
  
  // Handle keyboard click
  const handleKeyClick = useCallback((note) => {
    if (!selectedPitchRange) return;
    
    setPitchForRange(
      selectedPitchRange.start,
      selectedPitchRange.end,
      note.midi,
      note.name
    );
  }, [selectedPitchRange, setPitchForRange]);
  
  // Handle delete key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPitchRange) {
        clearPitchForRange(selectedPitchRange.start, selectedPitchRange.end);
        setSelectedPitchRange(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPitchRange, clearPitchForRange, setSelectedPitchRange]);
  
  return (
    <div className="pitch-container">
      {/* Piano keyboard */}
      <div 
        className="piano-keyboard" 
        ref={keyboardRef}
        style={{ height: '100%', overflowY: 'hidden' }}
      >
        {NOTES.map((note, index) => (
          <div
            key={note.midi}
            className={`piano-key ${note.isBlack ? 'black' : 'white'} ${hoveredNote === note.midi ? 'active' : ''}`}
            style={{ height: NOTE_HEIGHT }}
            onClick={() => handleKeyClick(note)}
            onMouseEnter={() => setHoveredNote(note.midi)}
            onMouseLeave={() => setHoveredNote(null)}
            title={`${note.name} (MIDI ${note.midi})${selectedPitchRange ? ' - Click to set' : ''}`}
          >
            {note.name.includes('C') && !note.name.includes('#') ? note.name : ''}
          </div>
        ))}
      </div>
      
      {/* Pitch canvas */}
      <div 
        className="pitch-canvas-container" 
        ref={containerRef}
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
          className="pitch-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            position: 'sticky',
            left: 0,
            top: 0
          }}
        />
      </div>
    </div>
  );
}

export default PitchEditor;
