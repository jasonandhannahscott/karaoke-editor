import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store';

// Simple audio progress bar component
function Waveform() {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  
  const {
    mp3Url,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
    duration,
    playbackSpeed
  } = useStore();
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  
  // Handle audio metadata loaded
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !mp3Url) return;
    
    setIsReady(false);
    setError(null);
    
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsReady(true);
    };
    
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const onEnded = () => {
      setIsPlaying(false);
    };
    
    const onError = (e) => {
      console.error('Audio error:', e);
      setError('Failed to load audio');
    };
    
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    
    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [mp3Url, setDuration, setCurrentTime, setIsPlaying]);
  
  // Handle play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    
    if (isPlaying) {
      audio.play().catch(err => console.error('Play error:', err));
    } else {
      audio.pause();
    }
  }, [isPlaying, isReady]);
  
  // Handle playback speed changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    
    audio.playbackRate = playbackSpeed || 1.0;
  }, [playbackSpeed, isReady]);
  
  // Handle seeking from external source (e.g., clicking on timeline)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    
    // Only seek if difference is significant (avoid feedback loop)
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isReady]);
  
  // Handle click on progress bar to seek
  const handleProgressClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !isReady || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  if (error) {
    return (
      <div className="waveform-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--error)',
        fontSize: '13px'
      }}>
        Error: {error}
      </div>
    );
  }
  
  return (
    <div className="waveform-container" style={{ position: 'relative' }}>
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={mp3Url}
        preload="metadata"
        style={{ display: 'none' }}
      />
      
      {/* Progress bar */}
      <div 
        ref={progressRef}
        onClick={handleProgressClick}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--surface)',
          cursor: 'pointer',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        {/* Progress fill */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${progressPercent}%`,
          background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
          opacity: 0.6,
          transition: 'width 0.1s linear'
        }} />
        
        {/* Playhead line */}
        <div style={{
          position: 'absolute',
          left: `${progressPercent}%`,
          top: 0,
          bottom: 0,
          width: '2px',
          background: 'var(--accent)',
          boxShadow: '0 0 8px var(--accent)'
        }} />
        
        {/* Loading indicator */}
        {!isReady && mp3Url && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '12px'
          }}>
            Loading audio...
          </div>
        )}
      </div>
    </div>
  );
}

export default Waveform;
