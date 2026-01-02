import React, { useEffect, useCallback, useRef } from 'react';
import { useStore } from './store';
import QueueView from './components/QueueView';
import EditorView from './components/EditorView';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

// Inner component that contains all the app logic
function AppContent() {
  console.log('AppContent rendering');
  
  const previewAudioRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  
  const { 
    currentView, 
    isDirty, 
    saveSong, 
    isPlaying,
    setIsPlaying,
    goToNextFlag,
    goToPrevFlag,
    selectedWordIndices,
    deleteWords,
    songData,
    setCurrentTime,
    undo,
    redo,
    canUndo,
    canRedo,
    selectNextWord,
    selectPrevWord,
    getSelectedWordTimeRange,
    mp3Url,
    playbackSpeed,
    autosaveEnabled,
    lastSaveTime
  } = useStore();
  
  console.log('AppContent: currentView =', currentView, 'songData =', songData?.title);
  
  // Quick preview function
  const playQuickPreview = useCallback(() => {
    const timeRange = getSelectedWordTimeRange();
    if (!timeRange || !previewAudioRef.current) return;
    
    // Clear any existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    
    const audio = previewAudioRef.current;
    const leadIn = 0.2; // 200ms lead-in
    const tailOut = 0.2; // 200ms tail
    
    const startTime = Math.max(0, timeRange.start - leadIn);
    const endTime = timeRange.end + tailOut;
    const duration = (endTime - startTime) / playbackSpeed;
    
    audio.currentTime = startTime;
    audio.playbackRate = playbackSpeed;
    audio.play().catch(err => console.error('Preview play error:', err));
    
    // Stop after duration
    previewTimeoutRef.current = setTimeout(() => {
      audio.pause();
    }, duration * 1000);
  }, [getSelectedWordTimeRange, playbackSpeed]);
  
  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    // Ctrl/Cmd + S: Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveSong();
      return;
    }
    
    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        undo();
      }
      return;
    }
    
    // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo()) {
        redo();
      }
      return;
    }
    
    // Space: Play/Pause
    if (e.key === ' ' && currentView === 'editor') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
      return;
    }
    
    // P: Quick Preview selected words
    if (e.key === 'p' && currentView === 'editor' && selectedWordIndices.length > 0) {
      e.preventDefault();
      playQuickPreview();
      return;
    }
    
    // Arrow keys for word navigation
    if (e.key === 'ArrowRight' && currentView === 'editor' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      selectNextWord();
      return;
    }
    
    if (e.key === 'ArrowLeft' && currentView === 'editor' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      selectPrevWord();
      return;
    }
    
    // Tab: Next flag
    if (e.key === 'Tab' && !e.shiftKey && currentView === 'editor') {
      e.preventDefault();
      const time = goToNextFlag();
      if (time !== null) {
        setCurrentTime(time);
      }
      return;
    }
    
    // Shift + Tab: Previous flag
    if (e.key === 'Tab' && e.shiftKey && currentView === 'editor') {
      e.preventDefault();
      const time = goToPrevFlag();
      if (time !== null) {
        setCurrentTime(time);
      }
      return;
    }
    
    // Delete/Backspace: Delete selected words
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWordIndices.length > 0) {
      e.preventDefault();
      deleteWords(selectedWordIndices);
      return;
    }
    
    // Escape: Clear selection
    if (e.key === 'Escape') {
      useStore.getState().clearSelection();
      return;
    }
  }, [currentView, isPlaying, selectedWordIndices, saveSong, setIsPlaying, goToNextFlag, goToPrevFlag, deleteWords, setCurrentTime, undo, redo, canUndo, canRedo, selectNextWord, selectPrevWord, playQuickPreview]);
  
  useEffect(() => {
    console.log('AppContent: keydown listener effect running');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('AppContent: keydown listener cleanup');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
  // Autosave effect
  useEffect(() => {
    if (!autosaveEnabled || !isDirty || currentView !== 'editor') return;
    
    const AUTOSAVE_INTERVAL = 30000; // 30 seconds
    
    const timer = setTimeout(() => {
      console.log('Autosaving...');
      saveSong();
    }, AUTOSAVE_INTERVAL);
    
    return () => clearTimeout(timer);
  }, [autosaveEnabled, isDirty, currentView, saveSong, lastSaveTime]);
  
  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);
  
  // Warn before leaving with unsaved changes
  useEffect(() => {
    console.log('AppContent: beforeunload effect running');
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      console.log('AppContent: beforeunload cleanup');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Debug: Log the actual songData structure
  if (songData) {
    console.log('AppContent: songData.title type:', typeof songData.title, 'value:', songData.title);
    console.log('AppContent: songData.artist type:', typeof songData.artist, 'value:', songData.artist);
  }

  // Safely convert any value to a displayable string
  const displayString = (value, fallback = 'Unknown') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    // For objects/arrays, stringify them for debugging
    return JSON.stringify(value);
  };

  console.log('AppContent: about to return JSX');

  return (
    <div className="app">
      {/* Hidden audio element for quick preview */}
      <audio 
        ref={previewAudioRef}
        src={mp3Url}
        preload="none"
        style={{ display: 'none' }}
      />
      
      <header className="app-header">
        <h1>Karaoke Editor</h1>
        {currentView === 'editor' && songData && (
          <>
            <div className="song-info">
              <div className="song-title">{displayString(songData.title, 'Untitled')}</div>
              <div className="song-artist">{displayString(songData.artist, 'Unknown Artist')}</div>
            </div>
            {isDirty && <div className="dirty-indicator" title="Unsaved changes" />}
          </>
        )}
      </header>
      
      <main className="app-main">
        <ErrorBoundary>
          {currentView === 'queue' ? <QueueView /> : <EditorView />}
        </ErrorBoundary>
      </main>
      
      <Toast />
    </div>
  );
}

// Main App component wraps everything in ErrorBoundary
function App() {
  console.log('App rendering');
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
