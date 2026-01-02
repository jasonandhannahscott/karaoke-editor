import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { generateFlags } from '../utils/alignment';

function QueueView() {
  const { 
    folderPath, 
    setFolderPath, 
    songQueue, 
    setSongQueue,
    currentSongIndex,
    setCurrentSongIndex,
    loadSong,
    // New filter features
    queueFilter,
    setQueueFilter,
    queueFilterMode,
    setQueueFilterMode,
    reviewedSongs,
    setReviewedForSong
  } = useStore();
  
  const [isScanning, setIsScanning] = useState(false);
  const [songFlags, setSongFlags] = useState({});
  const [skipFlagging, setSkipFlagging] = useState(false);
  
  // Compute filtered queue
  const filteredQueue = useMemo(() => {
    let filtered = songQueue;
    
    // Apply text filter
    if (queueFilter.trim()) {
      const search = queueFilter.toLowerCase();
      filtered = filtered.filter(song => 
        song.title?.toLowerCase().includes(search) ||
        song.artist?.toLowerCase().includes(search) ||
        song.fileName?.toLowerCase().includes(search)
      );
    }
    
    // Apply mode filter
    if (queueFilterMode === 'reviewed') {
      filtered = filtered.filter(song => reviewedSongs[song.jsonPath]);
    } else if (queueFilterMode === 'unreviewed') {
      filtered = filtered.filter(song => !reviewedSongs[song.jsonPath]);
    } else if (queueFilterMode === 'flagged') {
      filtered = filtered.filter(song => {
        const flags = songFlags[song.jsonPath];
        return flags && flags.total > 0;
      });
    } else if (queueFilterMode === 'clean') {
      filtered = filtered.filter(song => {
        const flags = songFlags[song.jsonPath];
        return flags && flags.total === 0;
      });
    }
    
    return filtered;
  }, [songQueue, queueFilter, queueFilterMode, reviewedSongs, songFlags]);
  
  // Helper to safely render a value as string
  const safeString = (value, fallback = 'Unknown') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  const handleSelectFolder = async () => {
    if (!window.electronAPI) {
      alert('This app must be run in Electron, not a browser. Run "npm run dev" to start properly.');
      return;
    }
    const path = await window.electronAPI.selectFolder();
    if (path) {
      setFolderPath(path);
      await scanFolder(path);
    }
  };
  
  const scanFolder = async (path) => {
    setIsScanning(true);
    const songs = await window.electronAPI.scanFolder(path);
    setSongQueue(songs);
    
    if (!skipFlagging) {
      // Generate flags for each song in background
      const flags = {};
      for (const song of songs) {
        const data = await window.electronAPI.loadSong(song.jsonPath);
        if (data) {
          const { flagCounts, totalFlags } = generateFlags(data);
          flags[song.jsonPath] = { ...flagCounts, total: totalFlags };
          
          // Load reviewed status
          if (data.reviewed !== undefined) {
            setReviewedForSong(song.jsonPath, !!data.reviewed);
          }
        }
      }
      setSongFlags(flags);
    }
    
    setIsScanning(false);
  };
  
  const handleSongClick = async (song, index) => {
    setCurrentSongIndex(index);
    await loadSong(song);
  };
  
  const getFlagBadges = (song) => {
    const flags = songFlags[song.jsonPath];
    if (!flags) return null;
    
    const badges = [];
    if (flags.text_mismatch > 0) {
      badges.push(<span key="mismatch" className="flag-badge mismatch">{flags.text_mismatch} mismatch</span>);
    }
    if (flags.timing_long + flags.timing_short > 0) {
      badges.push(<span key="timing" className="flag-badge timing">{flags.timing_long + flags.timing_short} timing</span>);
    }
    if (flags.overlap > 0) {
      badges.push(<span key="overlap" className="flag-badge overlap">{flags.overlap} overlap</span>);
    }
    if (badges.length === 0 && flags.total === 0) {
      badges.push(<span key="clean" className="flag-badge clean">Clean</span>);
    }
    
    return badges;
  };
  
  const totalFlags = Object.values(songFlags).reduce((sum, f) => sum + (f.total || 0), 0);
  const cleanSongs = Object.values(songFlags).filter(f => f.total === 0).length;
  const reviewedCount = Object.values(reviewedSongs).filter(Boolean).length;
  
  const isElectron = !!window.electronAPI;
  
  return (
    <div className="queue-view">
      {!isElectron && (
        <div style={{ 
          background: 'var(--error)', 
          color: 'white', 
          padding: '12px', 
          borderRadius: '4px', 
          marginBottom: '16px' 
        }}>
          ⚠️ Not running in Electron. File system access unavailable. Run <code>npm run dev</code> to start properly.
        </div>
      )}
      <div className="queue-header">
        <h2>Song Queue</h2>
        <button className="btn btn-primary" onClick={handleSelectFolder}>
          {folderPath ? 'Change Folder' : 'Select Folder'}
        </button>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
          <input 
            type="checkbox" 
            checked={skipFlagging} 
            onChange={(e) => setSkipFlagging(e.target.checked)} 
          />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Skip flag analysis (faster)
          </span>
        </label>
        
        {songQueue.length > 0 && (
          <div className="queue-stats">
            <span>{songQueue.length} songs</span>
            {Object.keys(songFlags).length > 0 && (
              <>
                <span>•</span>
                <span>{totalFlags} total flags</span>
                <span>•</span>
                <span>{cleanSongs} clean</span>
              </>
            )}
            <span>•</span>
            <span>{reviewedCount} reviewed</span>
          </div>
        )}
      </div>
      
      {/* Search and Filter */}
      {songQueue.length > 0 && (
        <div className="queue-filters">
          <div className="search-box">
            <input
              type="text"
              className="search-input"
              placeholder="Search songs..."
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value)}
            />
            {queueFilter && (
              <button className="search-clear" onClick={() => setQueueFilter('')}>
                ✕
              </button>
            )}
          </div>
          <div className="filter-buttons">
            <button 
              className={`btn-filter ${queueFilterMode === 'all' ? 'active' : ''}`}
              onClick={() => setQueueFilterMode('all')}
            >
              All
            </button>
            <button 
              className={`btn-filter ${queueFilterMode === 'unreviewed' ? 'active' : ''}`}
              onClick={() => setQueueFilterMode('unreviewed')}
            >
              Unreviewed
            </button>
            <button 
              className={`btn-filter ${queueFilterMode === 'reviewed' ? 'active' : ''}`}
              onClick={() => setQueueFilterMode('reviewed')}
            >
              Reviewed
            </button>
            <button 
              className={`btn-filter ${queueFilterMode === 'flagged' ? 'active' : ''}`}
              onClick={() => setQueueFilterMode('flagged')}
            >
              Flagged
            </button>
            <button 
              className={`btn-filter ${queueFilterMode === 'clean' ? 'active' : ''}`}
              onClick={() => setQueueFilterMode('clean')}
            >
              Clean
            </button>
          </div>
        </div>
      )}
      
      {isScanning ? (
        <div className="loading">
          <div className="loading-spinner" />
          <span style={{ marginLeft: '12px' }}>Scanning folder and analyzing songs...</span>
        </div>
      ) : songQueue.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <div>Select a folder containing .json and .mp3 file pairs</div>
          <button className="btn btn-primary" onClick={handleSelectFolder}>
            Select Folder
          </button>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div>No songs match your filter</div>
          <button className="btn btn-secondary" onClick={() => {
            setQueueFilter('');
            setQueueFilterMode('all');
          }}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="queue-list">
          {filteredQueue.map((song, index) => {
            const originalIndex = songQueue.indexOf(song);
            const isReviewed = reviewedSongs[song.jsonPath];
            return (
              <div 
                key={song.jsonPath}
                className={`queue-item ${originalIndex === currentSongIndex ? 'active' : ''} ${isReviewed ? 'reviewed' : ''}`}
                onClick={() => handleSongClick(song, originalIndex)}
              >
                <div className="queue-item-info">
                  <div className="queue-item-title">{safeString(song.title, 'Untitled')}</div>
                  <div className="queue-item-artist">{safeString(song.artist, 'Unknown Artist')}</div>
                </div>
                <div className="queue-item-flags">
                  {isReviewed && (
                    <span className="flag-badge reviewed">✓ Reviewed</span>
                  )}
                  {getFlagBadges(song)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {folderPath && (
        <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {folderPath}
        </div>
      )}
    </div>
  );
}

export default QueueView;
