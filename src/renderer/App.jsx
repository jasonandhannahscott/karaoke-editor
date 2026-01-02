import React, { useEffect, useCallback } from 'react';
import { useStore } from './store';
import QueueView from './components/QueueView';
import EditorView from './components/EditorView';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

// Inner component that contains all the app logic
function AppContent() {
  console.log('AppContent rendering');
  
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
    setCurrentTime
  } = useStore();
  
  console.log('AppContent: currentView =', currentView, 'songData =', songData?.title);
  
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
    
    // Space: Play/Pause
    if (e.key === ' ' && currentView === 'editor') {
      e.preventDefault();
      setIsPlaying(!isPlaying);
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
  }, [currentView, isPlaying, selectedWordIndices, saveSong, setIsPlaying, goToNextFlag, goToPrevFlag, deleteWords, setCurrentTime]);
  
  useEffect(() => {
    console.log('AppContent: keydown listener effect running');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('AppContent: keydown listener cleanup');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
  
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
