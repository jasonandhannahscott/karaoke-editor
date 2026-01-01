import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

// Generate note names for all 88 piano keys (A0 to C8)
const generateNoteNames = () => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteNames = [];
  
  // MIDI 21 = A0, MIDI 108 = C8
  for (let midi = 21; midi <= 108; midi++) {
    const octave = Math.floor((midi - 12) / 12);
    const noteIndex = midi % 12;
    noteNames.push({
      midi,
      name: notes[noteIndex] + octave,
      isBlack: [1, 3, 6, 8, 10].includes(noteIndex)
    });
  }
  
  return noteNames.reverse(); // High notes at top
};

const NOTES = generateNoteNames();
const NOTE_HEIGHT = 12;
const TOTAL_HEIGHT = NOTES.length * NOTE_HEIGHT;

function PitchEditor() {
  console.log('PitchEditor rendering');
  
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
  
  // Use songData.duration if available, fallback to store duration
  const effectiveDuration = songData?.duration || duration || 0;
  console.log('PitchEditor effectiveDuration:', effectiveDuration, 'from songData:', songData?.duration, 'from store:', duration);
  
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [hoveredNote, setHoveredNote] = useState(null);
  
  // Calculate canvas width based on duration and zoom
  useEffect(() => {
    if (effectiveDuration > 0) {
      setCanvasWidth(Math.max(effectiveDuration * zoom, containerRef.current?.clientWidth || 800));
    } else {
      // Default width when duration unknown
      setCanvasWidth(containerRef.current?.clientWidth || 800);
    }
  }, [effectiveDuration, zoom]);
  
  // Draw piano roll
  useEffect(() => {
    console.log('PitchEditor draw useEffect running');
    const canvas = canvasRef.current;
    if (!canvas || !songData?.pitch_data) {
      console.log('PitchEditor draw early return');
      return;
    }
    
    // Calculate canvas width directly
    const calculatedWidth = effectiveDuration > 0 
      ? Math.max(effectiveDuration * zoom, containerRef.current?.clientWidth || 800)
      : (containerRef.current?.clientWidth || 800);
    
    if (calculatedWidth < 10) {
      console.log('PitchEditor: canvas width too small, skipping draw');
      return;
    }
    
    // Update state for scroll sync
    if (calculatedWidth !== canvasWidth) {
      setCanvasWidth(calculatedWidth);
    }
    
    console.log('PitchEditor drawing', songData.pitch_data.length, 'pitch points');
    const ctx = canvas.getContext('2d');
    
    // Limit DPR for large canvases to avoid memory issues
    const rawDpr = window.devicePixelRatio || 1;
    const maxCanvasPixels = 16000 * 16000; // Max ~1GB
    const proposedPixels = calculatedWidth * rawDpr * TOTAL_HEIGHT * rawDpr;
    const dpr = proposedPixels > maxCanvasPixels ? 1 : Math.min(rawDpr, 2);
    
    console.log('PitchEditor: setting canvas size', calculatedWidth, 'x', TOTAL_HEIGHT, 'dpr:', dpr);
    // Set canvas size
    canvas.width = calculatedWidth * dpr;
    canvas.height = TOTAL_HEIGHT * dpr;
    canvas.style.width = `${calculatedWidth}px`;
    canvas.style.height = `${TOTAL_HEIGHT}px`;
    ctx.scale(dpr, dpr);
    
    console.log('PitchEditor: clearing canvas');
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, calculatedWidth, TOTAL_HEIGHT);
    
    console.log('PitchEditor: drawing note rows');
    
    // Draw note rows
    NOTES.forEach((note, index) => {
      const y = index * NOTE_HEIGHT;
      
      // Alternate row colors
      ctx.fillStyle = note.isBlack ? '#16213e' : '#1a1a2e';
      ctx.fillRect(0, y, calculatedWidth, NOTE_HEIGHT);
      
      // Draw gridline
      ctx.strokeStyle = '#252545';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(calculatedWidth, y);
      ctx.stroke();
    });
    
    console.log('PitchEditor: drawing time lines');
    
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
    
    console.log('PitchEditor: drawing pitch data points');
    
    // Draw pitch data
    ctx.fillStyle = '#e94560';
    
    let drawnPoints = 0;
    songData.pitch_data.forEach((point) => {
      if (point.midi_note === null) return;
      
      const x = point.time * zoom;
      const noteIndex = NOTES.findIndex(n => n.midi === point.midi_note);
      
      if (noteIndex >= 0) {
        const y = noteIndex * NOTE_HEIGHT;
        
        // Check if in selection
        if (selectedPitchRange && 
            point.time >= selectedPitchRange.start && 
            point.time <= selectedPitchRange.end) {
          ctx.fillStyle = '#ff9800';
        } else {
          ctx.fillStyle = '#e94560';
        }
        
        // Draw as small rectangle (1 sample = ~10ms)
        ctx.fillRect(x, y + 2, zoom * 0.01, NOTE_HEIGHT - 4);
        drawnPoints++;
      }
    });
    
    console.log('PitchEditor: drew', drawnPoints, 'pitch points');
    
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
    
    console.log('PitchEditor: drawing playhead');
    
    // Draw playhead
    const playheadX = currentTime * zoom;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, TOTAL_HEIGHT);
    ctx.stroke();
    
    console.log('PitchEditor: draw complete');
    
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
    
    // Convert to time range
    const startTime = startX / zoom;
    const endTime = endX / zoom;
    
    // Minimum selection size
    if (endTime - startTime > 0.05) {
      setSelectedPitchRange({ start: startTime, end: endTime });
    } else {
      // Click without drag - clear selection and seek
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
