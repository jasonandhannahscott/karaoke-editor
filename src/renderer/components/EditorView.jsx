import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import Waveform from './Waveform'; // Simple audio progress bar
import WordTimeline from './WordTimeline';
import PitchEditor from './PitchEditor';
import KaraokePreview from './KaraokePreview';
import WordEditModal from './WordEditModal';
import ContextMenu from './ContextMenu';
import ShortcutsHelp from './ShortcutsHelp';

function EditorView() {
  const {
    songData,
    isDirty,
    saveSong,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    zoom,
    setZoom,
    selectedWordIndices,
    showKaraokePreview,
    toggleKaraokePreview,
    setCurrentView,
    nextSong,
    prevSong,
    songQueue,
    currentSongIndex,
    flagCounts
  } = useStore();
  
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleZoomChange = (e) => {
    setZoom(parseInt(e.target.value));
  };
  
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00.00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };
  
  const handleWordDoubleClick = useCallback((index) => {
    setEditingWordIndex(index);
  }, []);
  
  const handleWordContextMenu = useCallback((e, indices) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      indices
    });
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  if (!songData) {
    return (
      <div className="empty-state">
        <div>No song loaded</div>
        <button className="btn btn-secondary" onClick={() => setCurrentView('queue')}>
          Back to Queue
        </button>
      </div>
    );
  }
  
  return (
    <div className="editor-view">
      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="btn btn-secondary" onClick={() => setCurrentView('queue')}>
            ← Queue
          </button>
          <button 
            className="btn btn-icon" 
            onClick={prevSong}
            disabled={currentSongIndex <= 0}
            title="Previous song"
          >
            ⏮
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {currentSongIndex + 1} / {songQueue.length}
          </span>
          <button 
            className="btn btn-icon" 
            onClick={nextSong}
            disabled={currentSongIndex >= songQueue.length - 1}
            title="Next song"
          >
            ⏭
          </button>
        </div>
        
        <div className="toolbar-group transport">
          <button className="btn btn-icon" onClick={handlePlayPause} title="Play/Pause (Space)">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="time-display">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        
        <div className="toolbar-group zoom-control">
          <span>Zoom:</span>
          <input 
            type="range" 
            min="10" 
            max="500" 
            value={zoom}
            onChange={handleZoomChange}
          />
          <span>{zoom}px/s</span>
        </div>
        
        <div className="toolbar-group">
          <button 
            className={`btn btn-icon ${showKaraokePreview ? 'active' : ''}`}
            onClick={toggleKaraokePreview}
            title="Toggle karaoke preview"
          >
            🎤
          </button>
        </div>
        
        <div className="toolbar-spacer" />
        
        {flagCounts && (
          <div className="toolbar-group" style={{ border: 'none' }}>
            {flagCounts.text_mismatch > 0 && (
              <span className="flag-badge mismatch">{flagCounts.text_mismatch}</span>
            )}
            {(flagCounts.timing_long + flagCounts.timing_short) > 0 && (
              <span className="flag-badge timing">{flagCounts.timing_long + flagCounts.timing_short}</span>
            )}
            {flagCounts.overlap > 0 && (
              <span className="flag-badge overlap">{flagCounts.overlap}</span>
            )}
          </div>
        )}
        
        <div className="toolbar-group" style={{ border: 'none' }}>
          <button 
            className="btn btn-primary" 
            onClick={saveSong}
            disabled={!isDirty}
          >
            Save
          </button>
        </div>
      </div>
      
      {/* Editor Panels */}
      <div className="editor-panels">
        {/* Audio Player */}
        <div className="panel waveform-panel">
          <div className="panel-header">Audio</div>
          <div className="panel-content">
            <Waveform />
          </div>
        </div>
        
        {/* Word Timeline */}
        <div className="panel timeline-panel">
          <div className="panel-header">
            Words
            {selectedWordIndices.length > 0 && (
              <span style={{ marginLeft: '8px', fontWeight: 'normal' }}>
                ({selectedWordIndices.length} selected)
              </span>
            )}
          </div>
          <div className="panel-content">
            <WordTimeline 
              onWordDoubleClick={handleWordDoubleClick}
              onWordContextMenu={handleWordContextMenu}
            />
          </div>
        </div>
        
        {/* Pitch Editor */}
        <div className="panel pitch-panel">
          <div className="panel-header">Pitch</div>
          <div className="panel-content">
            <PitchEditor />
          </div>
        </div>
        
        {/* Karaoke Preview */}
        {showKaraokePreview && (
          <div className="panel karaoke-preview">
            <KaraokePreview />
          </div>
        )}
      </div>
      
      {/* Word Edit Modal */}
      {editingWordIndex !== null && (
        <WordEditModal 
          wordIndex={editingWordIndex}
          onClose={() => setEditingWordIndex(null)}
        />
      )}
      
      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x}
          y={contextMenu.y}
          indices={contextMenu.indices}
          onClose={closeContextMenu}
          onEditWord={(index) => {
            setEditingWordIndex(index);
            closeContextMenu();
          }}
        />
      )}
      
      {/* Shortcuts Help */}
      <ShortcutsHelp />
    </div>
  );
}

export default EditorView;
