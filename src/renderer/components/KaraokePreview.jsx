import React, { useMemo } from 'react';
import { useStore } from '../store';

function KaraokePreview() {
  const { songData, currentTime, wordTracks } = useStore();
  
  // Group words into lines and determine current line
  const { currentLine, words } = useMemo(() => {
    if (!songData?.word_timings) {
      return { currentLine: [], words: [] };
    }
    
    // Only show track 0 (lead vocal) words for karaoke
    const leadWords = songData.word_timings
      .map((word, index) => ({ ...word, index }))
      .filter((_, index) => (wordTracks[index] || 0) === 0);
    
    if (leadWords.length === 0) {
      return { currentLine: [], words: [] };
    }
    
    // Find current word index
    let currentWordIndex = -1;
    for (let i = 0; i < leadWords.length; i++) {
      if (currentTime >= leadWords[i].start && currentTime <= leadWords[i].end) {
        currentWordIndex = i;
        break;
      }
      if (currentTime < leadWords[i].start) {
        currentWordIndex = i - 1;
        break;
      }
    }
    
    if (currentWordIndex === -1 && currentTime > leadWords[leadWords.length - 1].end) {
      currentWordIndex = leadWords.length - 1;
    }
    
    // Get context: ~5 words before and after
    const contextSize = 8;
    const startIndex = Math.max(0, currentWordIndex - contextSize);
    const endIndex = Math.min(leadWords.length, currentWordIndex + contextSize + 1);
    
    const lineWords = leadWords.slice(startIndex, endIndex);
    
    // Determine state for each word
    const wordsWithState = lineWords.map((word, i) => {
      const absoluteIndex = startIndex + i;
      let state = 'future';
      
      if (absoluteIndex < currentWordIndex) {
        state = 'past';
      } else if (absoluteIndex === currentWordIndex) {
        state = 'current';
      } else if (currentTime >= word.start) {
        state = 'current';
      }
      
      return {
        ...word,
        state
      };
    });
    
    return { currentLine: wordsWithState, words: leadWords };
  }, [songData, currentTime, wordTracks]);
  
  const labelWidth = 80;
  
  if (currentLine.length === 0) {
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ 
          width: labelWidth, 
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 500,
          color: 'var(--text-secondary)'
        }}>
          Preview
        </div>
        <div className="karaoke-preview-content" style={{ flex: 1 }}>
          <div className="karaoke-line" style={{ color: 'var(--text-muted)' }}>
            No lyrics to display
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ 
        width: labelWidth, 
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 500,
        color: 'var(--text-secondary)'
      }}>
        Preview
      </div>
      <div className="karaoke-preview-content" style={{ flex: 1 }}>
        <div className="karaoke-line">
          {currentLine.map((word, index) => (
            <span 
              key={`${word.index}-${index}`}
              className={`karaoke-word ${word.state}`}
            >
              {word.word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default KaraokePreview;
