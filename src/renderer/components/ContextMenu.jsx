import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

function ContextMenu({ x, y, indices, onClose, onEditWord }) {
  const menuRef = useRef(null);
  const [splitPosition, setSplitPosition] = useState('');
  
  const { 
    wordTracks, 
    moveWordsToTrack, 
    deleteWords,
    songData,
    mergeWords,
    splitWord
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
  
  // Check if selected words are consecutive (for merge)
  const areConsecutive = () => {
    if (indices.length < 2) return false;
    const sorted = [...indices].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  };
  
  const canMerge = indices.length >= 2 && areConsecutive();
  
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
  
  const handleMerge = () => {
    if (canMerge) {
      mergeWords(indices);
      onClose();
    }
  };
  
  const handleSplitHalf = () => {
    if (isSingleWord && word) {
      const halfPos = Math.floor(word.word.length / 2);
      if (halfPos > 0) {
        splitWord(indices[0], halfPos);
        onClose();
      }
    }
  };
  
  const handleSplitAt = () => {
    if (isSingleWord && word && splitPosition) {
      const pos = parseInt(splitPosition);
      if (pos > 0 && pos < word.word.length) {
        splitWord(indices[0], pos);
        onClose();
      }
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
      
      {/* Merge option - only shown for multiple consecutive words */}
      {indices.length >= 2 && (
        <div 
          className={`context-menu-item ${canMerge ? '' : 'disabled'}`} 
          onClick={canMerge ? handleMerge : undefined}
          title={!canMerge ? 'Can only merge consecutive words' : ''}
        >
          🔗 Merge {indices.length} words
        </div>
      )}
      
      {/* Split options - only shown for single word */}
      {isSingleWord && word && word.word.length >= 2 && (
        <>
          <div className="context-menu-item" onClick={handleSplitHalf}>
            ✂️ Split in half
          </div>
          <div className="context-menu-item" style={{ padding: '4px 12px' }}>
            <span style={{ marginRight: '8px' }}>✂️ Split at:</span>
            <input
              type="number"
              min="1"
              max={word.word.length - 1}
              value={splitPosition}
              onChange={(e) => setSplitPosition(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '40px',
                padding: '2px 4px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--bg-tertiary)',
                borderRadius: '2px',
                color: 'var(--text-primary)',
                marginRight: '4px'
              }}
              placeholder="pos"
            />
            <button
              onClick={(e) => { e.stopPropagation(); handleSplitAt(); }}
              disabled={!splitPosition || parseInt(splitPosition) <= 0 || parseInt(splitPosition) >= word.word.length}
              style={{
                padding: '2px 8px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '2px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Split
            </button>
          </div>
        </>
      )}
      
      <div className="context-menu-divider" />
      
      <div className="context-menu-item danger" onClick={handleDelete}>
        🗑️ Delete
      </div>
    </div>
  );
}

export default ContextMenu;
