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

function PitchEditor() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const keyboardRef = useRef(null);
  
  const {
    songData,
    zoom,
    currentTime,
    duration,
    selectedPitchRange,
    setSelectedPitchRange,
    setPitchForRange,
    clearPitchForRange,
    setCurrentTime
  } = useStore();
  
  const effectiveDuration = songData?.duration || duration || 0;
  
  const [containerWidth, setContainerWidth] = useState(800);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [hoveredNote, setHoveredNote] = useState(null);
  
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

  // Calculate canvas width derived from state/props (no side effects)
  const canvasWidth = effectiveDuration > 0 
    ? Math.max(effectiveDuration * zoom, containerWidth)
    : containerWidth;
  
  // Draw piano roll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !songData?.pitch_data) return;
    
    if (canvasWidth < 10) return;
    
    const ctx = canvas.getContext('2d');
    
    // Limit DPR for large canvases
    const rawDpr = window.devicePixelRatio || 1;
    const maxCanvasPixels = 16000 * 16000;
    const proposedPixels = canvasWidth * rawDpr * TOTAL_HEIGHT * rawDpr;
    const dpr = proposedPixels > maxCanvasPixels ? 1 : Math.min(rawDpr, 2);
    
    // Set canvas size
    canvas.width = canvasWidth * dpr;
    canvas.height = TOTAL_HEIGHT * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, TOTAL_HEIGHT);
    
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
    
    // Draw vertical time lines
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.strokeStyle = '#333';
    for (let t = 0; t <= effectiveDuration; t += timeStep) {
      const x = t * zoom;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TOTAL_HEIGHT);
      ctx.stroke();
    }
    
    // Draw pitch data
    ctx.fillStyle = '#e94560';
    
    songData.pitch_data.forEach((point) => {
      if (point.midi_note === null) return;
      
      const x = point.time * zoom;
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
        
        ctx.fillRect(x, y + 2, zoom * 0.01, NOTE_HEIGHT - 4);
      }
    });
    
    // Draw selection box
    if (isSelecting && selectionStart !== null && selectionEnd !== null) {
      const startX = Math.min(selectionStart.x, selectionEnd.x);
      const endX = Math.max(selectionStart.x, selectionEnd.x);
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
    const playheadX = currentTime * zoom;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, TOTAL_HEIGHT);
    ctx.stroke();
    
  }, [songData, zoom, effectiveDuration, canvasWidth, currentTime, selectedPitchRange, isSelecting, selectionStart, selectionEnd]);
  
  // Handle mouse events for selection
  const handleMouseDown = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
  }, []);
  
  const handleMouseMove = useCallback((e) => {
    if (!isSelecting) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + containerRef.current.scrollLeft;
    const y = e.clientY - rect.top + containerRef.current.scrollTop;
    
    setSelectionEnd({ x, y });
  }, [isSelecting]);
  
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
  
  // Sync keyboard scroll with canvas scroll
  const handleCanvasScroll = useCallback(() => {
    if (keyboardRef.current && containerRef.current) {
      keyboardRef.current.scrollTop = containerRef.current.scrollTop;
    }
  }, []);
  
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
        onScroll={handleCanvasScroll}
      >
        <canvas
          ref={canvasRef}
          className="pitch-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
}

export default PitchEditor;
