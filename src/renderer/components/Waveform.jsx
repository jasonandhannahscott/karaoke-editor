import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStore } from '../store';

const RENDER_BUFFER = 200;

function Waveform() {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    mp3Url,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
    duration,
    playbackSpeed,
    zoom,
    setZoom,
    timelineScrollLeft,
    setTimelineScrollLeft
  } = useStore();
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [containerWidth, setContainerWidth] = useState(800);
  
  const effectiveDuration = duration || 0;
  const totalTimelineWidth = effectiveDuration > 0 
    ? Math.max(effectiveDuration * zoom, containerWidth)
    : containerWidth;
  
  const totalHeight = 50;
  
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
  
  // Handle seeking from external source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReady) return;
    
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, isReady]);

  // Setup ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect) {
          requestAnimationFrame(() => {
            setContainerWidth(entry.contentRect.width);
          });
        }
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Sync scroll from container to store
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setTimelineScrollLeft(container.scrollLeft);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setTimelineScrollLeft]);

  // Sync scroll from store to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    if (Math.abs(container.scrollLeft - timelineScrollLeft) > 1) {
      container.scrollLeft = timelineScrollLeft;
    }
  }, [timelineScrollLeft]);

  // Scroll wheel zoom handler
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setZoom(zoom + delta);
    }
  }, [zoom, setZoom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Draw audio timeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasWidth = containerWidth;
    const scrollLeft = timelineScrollLeft;
    
    canvas.width = canvasWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);
    
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, totalHeight);
    
    // Visible time range
    const visibleStartX = scrollLeft - RENDER_BUFFER;
    const visibleEndX = scrollLeft + canvasWidth + RENDER_BUFFER;
    const visibleStartTime = Math.max(0, visibleStartX / zoom);
    const visibleEndTime = Math.min(effectiveDuration, visibleEndX / zoom);
    
    // Draw time markers
    const timeStep = zoom >= 100 ? 1 : zoom >= 50 ? 2 : zoom >= 20 ? 5 : 10;
    ctx.strokeStyle = '#333';
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    
    const startTime = Math.floor(visibleStartTime / timeStep) * timeStep;
    for (let t = startTime; t <= visibleEndTime; t += timeStep) {
      const virtualX = t * zoom;
      const canvasX = virtualX - scrollLeft;
      
      if (canvasX >= -50 && canvasX <= canvasWidth + 50) {
        ctx.beginPath();
        ctx.moveTo(canvasX, 15);
        ctx.lineTo(canvasX, totalHeight);
        ctx.stroke();
        ctx.fillText(`${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, '0')}`, canvasX + 2, 12);
      }
    }
    
    // Draw progress bar background
    ctx.fillStyle = '#252545';
    ctx.fillRect(0, totalHeight - 8, canvasWidth, 6);
    
    // Draw progress
    if (effectiveDuration > 0) {
      const progressEndX = (currentTime * zoom) - scrollLeft;
      ctx.fillStyle = 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)';
      ctx.fillStyle = '#e94560';
      ctx.fillRect(0, totalHeight - 8, Math.max(0, progressEndX), 6);
    }
    
    // Draw playhead
    const playheadVirtualX = currentTime * zoom;
    const playheadCanvasX = playheadVirtualX - scrollLeft;
    
    if (playheadCanvasX >= -5 && playheadCanvasX <= canvasWidth + 5) {
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadCanvasX, 0);
      ctx.lineTo(playheadCanvasX, totalHeight);
      ctx.stroke();
      
      // Playhead triangle
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(playheadCanvasX - 6, 0);
      ctx.lineTo(playheadCanvasX + 6, 0);
      ctx.lineTo(playheadCanvasX, 10);
      ctx.closePath();
      ctx.fill();
    }
    
  }, [containerWidth, timelineScrollLeft, effectiveDuration, zoom, currentTime]);
  
  const canvasToVirtual = useCallback((canvasX) => {
    return canvasX + timelineScrollLeft;
  }, [timelineScrollLeft]);

  // Handle click to seek
  const handleClick = (e) => {
    const audio = audioRef.current;
    if (!audio || !isReady || !effectiveDuration) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const virtualX = canvasToVirtual(canvasX);
    const time = virtualX / zoom;
    
    const newTime = Math.max(0, Math.min(time, effectiveDuration));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  if (error) {
    return (
      <div className="waveform-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--error)',
        fontSize: '13px',
        height: '100%'
      }}>
        Error: {error}
      </div>
    );
  }
  
  return (
    <div className="waveform-container" style={{ position: 'relative', height: '100%' }}>
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={mp3Url}
        preload="metadata"
        style={{ display: 'none' }}
      />
      
      {/* Timeline canvas with scroll */}
      <div 
        ref={containerRef}
        onClick={handleClick}
        style={{
          height: '100%',
          overflowX: 'scroll',
          overflowY: 'hidden',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        {/* Spacer for scroll width */}
        <div style={{ 
          width: totalTimelineWidth, 
          height: 1, 
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }} />
        
        <canvas
          ref={canvasRef}
          style={{ 
            position: 'sticky',
            left: 0,
            top: 0,
            display: 'block'
          }}
        />
      </div>
      
      {/* Loading indicator */}
      {!isReady && mp3Url && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          background: 'rgba(26, 26, 46, 0.8)'
        }}>
          Loading audio...
        </div>
      )}
    </div>
  );
}

export default Waveform;
