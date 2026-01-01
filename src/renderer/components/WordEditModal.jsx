import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';

function WordEditModal({ wordIndex, onClose }) {
  const { songData, wordFlags, updateWord } = useStore();
  
  const word = songData?.word_timings[wordIndex];
  const flags = wordFlags[wordIndex] || [];
  
  const [text, setText] = useState(word?.word || '');
  const [start, setStart] = useState(word?.start?.toFixed(3) || '0');
  const [end, setEnd] = useState(word?.end?.toFixed(3) || '0');
  const [speaker, setSpeaker] = useState(word?.speaker || '');
  
  const textInputRef = useRef(null);
  
  useEffect(() => {
    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, []);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        handleSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, start, end, speaker]);
  
  const handleSave = () => {
    const startNum = parseFloat(start);
    const endNum = parseFloat(end);
    
    if (isNaN(startNum) || isNaN(endNum)) {
      alert('Invalid timing values');
      return;
    }
    
    if (endNum <= startNum) {
      alert('End time must be greater than start time');
      return;
    }
    
    updateWord(wordIndex, {
      word: text.trim(),
      start: startNum,
      end: endNum,
      speaker: speaker || null
    });
    
    onClose();
  };
  
  // Find suggested word from flags
  const suggestedWord = flags.find(f => f.suggestedWord)?.suggestedWord;
  
  if (!word) {
    return null;
  }
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Word</h3>
          <button className="btn btn-icon" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {flags.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Flags:
              </div>
              {flags.map((flag, i) => (
                <div 
                  key={i}
                  style={{ 
                    padding: '6px 10px', 
                    background: 'var(--bg-tertiary)', 
                    borderRadius: '4px',
                    marginBottom: '4px',
                    fontSize: '12px'
                  }}
                >
                  {flag.message}
                </div>
              ))}
            </div>
          )}
          
          <div className="form-group">
            <label>Word Text</label>
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            {suggestedWord && suggestedWord !== text && (
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '8px' }}
                onClick={() => setText(suggestedWord)}
              >
                Use suggested: "{suggestedWord}"
              </button>
            )}
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Start Time (s)</label>
              <input
                type="number"
                step="0.001"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>End Time (s)</label>
              <input
                type="number"
                step="0.001"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Speaker (optional)</label>
            <input
              type="text"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="e.g., lead, harmony"
            />
          </div>
          
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Duration: {(parseFloat(end) - parseFloat(start)).toFixed(3)}s
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default WordEditModal;
