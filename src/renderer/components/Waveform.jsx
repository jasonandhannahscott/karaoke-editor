import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '../store';

function Waveform() {
  console.log('Waveform rendering');
  
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const mountedRef = useRef(true);
  const lastSeekRef = useRef(0);
  
  const {
    mp3Url,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    setDuration,
    zoom
  } = useStore();
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize wavesurfer
  useEffect(() => {
    console.log('Waveform useEffect running, mp3Url:', mp3Url ? 'present' : 'missing');
    if (!containerRef.current || !mp3Url) {
      console.log('Waveform useEffect early return');
      return;
    }
    
    console.log('Waveform creating WaveSurfer instance');
    mountedRef.current = true;
    setIsReady(false);
    setError(null);
    
    // Clean up previous instance
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (e) {
        // Ignore cleanup errors
      }
      wavesurferRef.current = null;
    }
    
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4a5568',
      progressColor: '#e94560',
      cursorColor: '#e94560',
      cursorWidth: 2,
      height: 80,
      normalize: true,
      fillParent: true,
      backend: 'WebAudio'
    });
    
    wavesurfer.on('ready', () => {
      if (!mountedRef.current) return;
      setDuration(wavesurfer.getDuration());
      setIsReady(true);
    });
    
    wavesurfer.on('audioprocess', (time) => {
      if (!mountedRef.current) return;
      setCurrentTime(time);
    });
    
    wavesurfer.on('seeking', (time) => {
      if (!mountedRef.current) return;
      setCurrentTime(time);
    });
    
    wavesurfer.on('finish', () => {
      if (!mountedRef.current) return;
      setIsPlaying(false);
    });
    
    wavesurfer.on('error', (err) => {
      if (!mountedRef.current) return;
      console.error('Wavesurfer error:', err);
      setError(err.message || 'Failed to load audio');
    });
    
    wavesurferRef.current = wavesurfer;
    
    // Load audio - mp3Url is a base64 data URL
    // Convert to blob for better handling
    try {
      if (mp3Url.startsWith('data:')) {
        console.log('Waveform: converting base64 to blob');
        // Convert base64 to blob
        const parts = mp3Url.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'audio/mpeg';
        const binaryString = atob(parts[1]);
        console.log('Waveform: decoded base64, length:', binaryString.length);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mime });
        console.log('Waveform: created blob, size:', blob.size);
        wavesurfer.loadBlob(blob);
        console.log('Waveform: loadBlob called');
      } else {
        wavesurfer.load(mp3Url);
      }
    } catch (err) {
      console.error('Error loading audio:', err);
      setError(err.message || 'Failed to load audio');
    }
    
    return () => {
      mountedRef.current = false;
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (e) {
          // Ignore cleanup errors
        }
        wavesurferRef.current = null;
      }
    };
  }, [mp3Url]);
  
  // Handle play/pause
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;
    
    try {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    } catch (e) {
      console.error('Play/pause error:', e);
    }
  }, [isPlaying, isReady]);
  
  // Handle zoom changes
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;
    try {
      wavesurferRef.current.zoom(zoom);
    } catch (e) {
      // Ignore zoom errors
    }
  }, [zoom, isReady]);
  
  // Handle external seeking (when currentTime changes from outside wavesurfer)
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;
    
    const ws = wavesurferRef.current;
    const duration = ws.getDuration();
    if (duration <= 0) return;
    
    const wsTime = ws.getCurrentTime();
    // Only seek if the change is significant and not from our own updates
    if (Math.abs(wsTime - currentTime) > 0.2 && Date.now() - lastSeekRef.current > 100) {
      lastSeekRef.current = Date.now();
      ws.seekTo(currentTime / duration);
    }
  }, [currentTime, isReady]);
  
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
    <div className="waveform-container" ref={containerRef}>
      {!isReady && mp3Url && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '13px'
        }}>
          Loading waveform...
        </div>
      )}
    </div>
  );
}

export default Waveform;
