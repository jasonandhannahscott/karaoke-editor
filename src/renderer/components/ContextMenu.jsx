import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';

function ContextMenu({ x, y, indices, onClose, onEditWord }) {
  const menuRef = useRef(null);
  
  const { 
    wordTracks, 
    moveWordsToTrack, 
    deleteWords,
    songData
  } = useStore();
  
  // Adjust position if menu would go off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuEl = menuRef.current;
      
      if (rect.right > window.innerWidth) {
        menuEl.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menuEl.style.top = `${y - rect.height}px`;
      }
    }
  }, [x, y]);
  
  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  
  const isSingleWord = indices.length === 1;
  const word = isSingleWord ? songData?.word_timings[indices[0]] : null;
  
  // Check current track of selected words
  const allOnTrack0 = indices.every(i => (wordTracks[i] || 0) === 0);
  const allOnTrack1 = indices.every(i => (wordTracks[i] || 0) === 1);
  
  const handleMoveToTrack = (track) => {
    moveWordsToTrack(indices, track);
    onClose();
  };
  
  const handleDelete = () => {
    deleteWords(indices);
    onClose();
  };
  
  const handleEdit = () => {
    if (isSingleWord) {
      onEditWord(indices[0]);
    }
  };
  
  return (
    <div 
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {isSingleWord && (
        <>
          <div className="context-menu-item" onClick={handleEdit}>
            ✏️ Edit "{word?.word}"
          </div>
          <div className="context-menu-divider" />
        </>
      )}
      
      <div className="context-menu-item" style={{ fontWeight: 500, pointerEvents: 'none', color: 'var(--text-secondary)' }}>
        {indices.length} word{indices.length > 1 ? 's' : ''} selected
      </div>
      
      <div className="context-menu-divider" />
      
      {!allOnTrack0 && (
        <div className="context-menu-item" onClick={() => handleMoveToTrack(0)}>
          🎤 Move to Lead track
        </div>
      )}
      
      {!allOnTrack1 && (
        <div className="context-menu-item" onClick={() => handleMoveToTrack(1)}>
          🎵 Move to Harmony track
        </div>
      )}
      
      <div className="context-menu-divider" />
      
      <div className="context-menu-item danger" onClick={handleDelete}>
        🗑️ Delete
      </div>
    </div>
  );
}

export default ContextMenu;
