import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '../store';

// WaveSurfer version - may crash in dev mode but work in production
function WaveformWaveSurfer() {
  console.log('WaveformWaveSurfer rendering');
  
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const mountedRef = useRef(true);
  
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
  
  useEffect(() => {
    console.log('WaveformWaveSurfer useEffect, mp3Url:', mp3Url ? 'present' : 'missing');
    if (!containerRef.current || !mp3Url) return;
    
    mountedRef.current = true;
    setIsReady(false);
    setError(null);
    
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch (e) {}
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
      console.log('WaveSurfer ready');
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
      console.error('WaveSurfer error:', err);
      setError(err.message || 'Failed to load audio');
    });
    
    wavesurferRef.current = wavesurfer;
    
    console.log('WaveformWaveSurfer: loading audio');
    try {
      wavesurfer.load(mp3Url);
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message);
    }
    
    return () => {
      mountedRef.current = false;
      if (wavesurferRef.current) {
        try {
          wavesurferRef.current.destroy();
        } catch (e) {}
        wavesurferRef.current = null;
      }
    };
  }, [mp3Url]);
  
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;
    try {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    } catch (e) {}
  }, [isPlaying, isReady]);
  
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;
    try {
      wavesurferRef.current.zoom(zoom);
    } catch (e) {}
  }, [zoom, isReady]);
  
  if (error) {
    return (
      <div className="waveform-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--error)'
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
          color: 'var(--text-secondary)'
        }}>
          Loading waveform...
        </div>
      )}
    </div>
  );
}

export default WaveformWaveSurfer;
