import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import ErrorBoundary from './ErrorBoundary';
import Waveform from './Waveform';
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
    setCurrentView,
    nextSong,
    prevSong,
    songQueue,
    currentSongIndex,
    flagCounts,
    undo,
    redo,
    canUndo,
    canRedo,
    playbackSpeed,
    setPlaybackSpeed,
    toggleReviewed,
    isReviewed,
    autoFixOverlaps,
    autosaveEnabled,
    changeAudioFile,
    pitchPanelCollapsed,
    togglePitchPanel
  } = useStore();
  
  const [editingWordIndex, setEditingWordIndex] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [toast, setToast] = useState(null);
  
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };
  
  const handleZoomChange = (e) => {
    setZoom(parseInt(e.target.value));
  };
  
  const handleSpeedChange = (e) => {
    setPlaybackSpeed(parseFloat(e.target.value));
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
  
  const handleAutoFix = () => {
    const fixCount = autoFixOverlaps();
    if (fixCount > 0) {
      showToast(`Fixed ${fixCount} overlap${fixCount > 1 ? 's' : ''}`, 'success');
    } else {
      showToast('No overlaps to fix', 'info');
    }
  };
  
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const handleChangeAudio = async () => {
    const filePath = await changeAudioFile();
    if (filePath) {
      const fileName = filePath.split(/[/\\]/).pop();
      showToast(`Audio changed to: ${fileName}`, 'success');
    }
  };
  
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
  
  const reviewed = isReviewed();
  const hasOverlaps = flagCounts && flagCounts.overlap > 0;
  
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
        
        {/* Undo/Redo buttons */}
        <div className="toolbar-group">
          <button 
            className="btn btn-icon" 
            onClick={undo}
            disabled={!canUndo()}
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button 
            className="btn btn-icon" 
            onClick={redo}
            disabled={!canRedo()}
            title="Redo (Ctrl+Y)"
          >
            ↪
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
        
        {/* Playback Speed Control */}
        <div className="toolbar-group speed-control">
          <span>Speed:</span>
          <select 
            className="speed-select"
            value={playbackSpeed}
            onChange={handleSpeedChange}
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
        
        <div className="toolbar-group zoom-control">
          <span>Zoom:</span>
          <input 
            type="range" 
            min="10" 
            max="200" 
            value={zoom}
            onChange={handleZoomChange}
          />
          <span>{zoom}px/s</span>
        </div>
        
        <div className="toolbar-spacer" />
        
        {/* Auto-fix overlaps button */}
        {hasOverlaps && (
          <div className="toolbar-group" style={{ border: 'none' }}>
            <button 
              className="btn btn-warning"
              onClick={handleAutoFix}
              title="Auto-fix overlapping words"
            >
              Fix {flagCounts.overlap} Overlaps
            </button>
          </div>
        )}
        
        {flagCounts && (
          <div className="toolbar-group" style={{ border: 'none' }}>
            {flagCounts.text_mismatch > 0 && (
              <span className="flag-badge mismatch" title="Text mismatch: Words differ from lyrics">{flagCounts.text_mismatch}</span>
            )}
            {(flagCounts.timing_long + flagCounts.timing_short) > 0 && (
              <span className="flag-badge timing" title="Timing issues: Words too long or too short">{flagCounts.timing_long + flagCounts.timing_short}</span>
            )}
            {flagCounts.overlap > 0 && (
              <span className="flag-badge overlap" title="Overlaps: Words overlap with each other">{flagCounts.overlap}</span>
            )}
          </div>
        )}
        
        {/* Reviewed toggle */}
        <div className="toolbar-group" style={{ border: 'none' }}>
          <button 
            className={`btn ${reviewed ? 'btn-success' : 'btn-secondary'}`}
            onClick={toggleReviewed}
            title="Mark as reviewed"
          >
            {reviewed ? '✓ Reviewed' : 'Mark Reviewed'}
          </button>
        </div>
        
        {/* Autosave indicator */}
        {autosaveEnabled && isDirty && (
          <span title="Autosave enabled" style={{ fontSize: '16px', marginRight: '8px' }}>💾</span>
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
        {/* Audio Player - Compact */}
        <div className="panel audio-panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Audio</span>
            <button 
              className="btn btn-secondary" 
              onClick={handleChangeAudio}
              style={{ padding: '2px 8px', fontSize: '11px' }}
              title="Select a different audio file"
            >
              Change Audio
            </button>
          </div>
          <div className="panel-content">
            <Waveform />
          </div>
        </div>
        
        {/* Karaoke Preview - Between Audio and Words */}
        <div className="panel karaoke-preview-panel">
          <KaraokePreview />
        </div>
        
        {/* Word Timeline - Taller */}
        <div className="panel timeline-panel">
          <div className="panel-header">
            <span>Words</span>
            {selectedWordIndices.length > 0 && (
              <span style={{ marginLeft: '8px', fontWeight: 'normal' }}>
                ({selectedWordIndices.length} selected)
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>
              Ctrl+Scroll to zoom
            </span>
          </div>
          <div className="panel-content">
            <ErrorBoundary>
              <WordTimeline 
                onWordDoubleClick={handleWordDoubleClick}
                onWordContextMenu={handleWordContextMenu}
              />
            </ErrorBoundary>
          </div>
        </div>
        
        {/* Pitch Editor - Collapsible */}
        <div className={`panel pitch-panel ${pitchPanelCollapsed ? 'collapsed' : ''}`}>
          <div 
            className="panel-header" 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={togglePitchPanel}
          >
            <span style={{ 
              transform: pitchPanelCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              display: 'inline-block'
            }}>
              ▼
            </span>
            <span>Pitch</span>
            {pitchPanelCollapsed && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                (click to expand)
              </span>
            )}
          </div>
          {!pitchPanelCollapsed && (
            <div className="panel-content">
              <ErrorBoundary>
                <PitchEditor />
              </ErrorBoundary>
            </div>
          )}
        </div>
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
      
      {/* Toast notification */}
      {toast && (
        <div className={`editor-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
      
      {/* Shortcuts Help */}
      <ShortcutsHelp />
    </div>
  );
}

export default EditorView;
