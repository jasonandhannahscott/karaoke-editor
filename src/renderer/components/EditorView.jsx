import React, { useEffect } from 'react';
import { useStore } from '../store';

function EditorView() {
  console.log('EditorView rendering');
  
  const {
    songData,
    setCurrentView,
    flagCounts
  } = useStore();
  
  useEffect(() => {
    console.log('EditorView mounted');
    return () => console.log('EditorView unmounting');
  }, []);
  
  if (!songData) {
    console.log('EditorView: no songData, showing empty state');
    return (
      <div className="empty-state">
        <div>No song loaded</div>
        <button className="btn btn-secondary" onClick={() => setCurrentView('queue')}>
          Back to Queue
        </button>
      </div>
    );
  }
  
  console.log('EditorView: rendering main UI for', songData.title);
  
  // MINIMAL TEST VERSION
  return (
    <div className="editor-view" style={{ padding: '20px' }}>
      <div style={{ background: 'lime', color: 'black', padding: '10px', marginBottom: '10px' }}>
        DEBUG: Editor loaded successfully!
      </div>
      <div style={{ background: '#333', padding: '10px', marginBottom: '10px' }}>
        <strong>Song:</strong> {songData.title} by {songData.artist}
      </div>
      <div style={{ background: '#333', padding: '10px', marginBottom: '10px' }}>
        <strong>Duration:</strong> {songData.duration}s
      </div>
      <div style={{ background: '#333', padding: '10px', marginBottom: '10px' }}>
        <strong>Words:</strong> {songData.word_timings?.length || 0}
      </div>
      <div style={{ background: '#333', padding: '10px', marginBottom: '10px' }}>
        <strong>Pitch points:</strong> {songData.pitch_data?.length || 0}
      </div>
      <div style={{ background: '#333', padding: '10px', marginBottom: '10px' }}>
        <strong>Flags:</strong> {JSON.stringify(flagCounts)}
      </div>
      <button 
        className="btn btn-secondary" 
        onClick={() => setCurrentView('queue')}
        style={{ marginTop: '10px' }}
      >
        Back to Queue
      </button>
    </div>
  );
}

export default EditorView;
