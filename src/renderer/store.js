import { create } from 'zustand';
import { generateFlags } from './utils/alignment';

export const useStore = create((set, get) => ({
  // Folder/Queue state
  folderPath: null,
  songQueue: [],
  currentSongIndex: -1,
  
  // Song data
  songData: null,
  songPath: null,
  mp3Url: null,
  isDirty: false,
  
  // Flags
  wordFlags: [],
  alignment: [],
  flagCounts: {},
  
  // Playback state
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  
  // View state
  zoom: 50, // pixels per second
  scrollPosition: 0,
  
  // Selection state
  selectedWordIndices: [],
  selectedTrack: 0, // 0 = main, 1 = secondary
  selectedPitchRange: null, // { start: time, end: time }
  
  // Word track assignments (index -> track number)
  wordTracks: {}, // { [wordIndex]: 0 | 1 }
  
  // UI state
  currentView: 'queue', // 'queue' | 'editor'
  showKaraokePreview: true,
  
  // Actions
  setFolderPath: (path) => set({ folderPath: path }),
  
  setSongQueue: (queue) => set({ songQueue: queue }),
  
  setCurrentSongIndex: (index) => set({ currentSongIndex: index }),
  
  loadSong: async (song) => {
    console.log('loadSong called:', song.jsonPath);
    const data = await window.electronAPI.loadSong(song.jsonPath);
    console.log('Song data loaded:', data ? 'success' : 'failed', data ? `${data.word_timings?.length} words, ${data.pitch_data?.length} pitch points` : '');
    const mp3Url = await window.electronAPI.loadAudioFile(song.mp3Path);
    console.log('Audio loaded:', mp3Url ? `${mp3Url.length} bytes` : 'failed');
    
    if (data) {
      console.log('Generating flags...');
      const { wordFlags, alignment, flagCounts } = generateFlags(data);
      console.log('Flags generated:', flagCounts);
      
      // Initialize word tracks (all on track 0)
      const wordTracks = {};
      if (data.word_timings) {
        data.word_timings.forEach((_, i) => {
          wordTracks[i] = 0;
        });
      }
      
      set({
        songData: data,
        songPath: song.jsonPath,
        mp3Url,
        isDirty: false,
        wordFlags,
        alignment,
        flagCounts,
        wordTracks,
        selectedWordIndices: [],
        selectedPitchRange: null,
        currentView: 'editor'
      });
      console.log('State updated, switching to editor view');
    }
  },
  
  saveSong: async () => {
    const { songPath, songData, wordTracks } = get();
    if (!songPath || !songData) return false;
    
    // Add track info to word timings
    const dataToSave = {
      ...songData,
      word_timings: songData.word_timings.map((timing, i) => ({
        ...timing,
        track: wordTracks[i] || 0
      }))
    };
    
    const success = await window.electronAPI.saveSong(songPath, dataToSave);
    if (success) {
      set({ isDirty: false });
    }
    return success;
  },
  
  // Regenerate flags after edits
  regenerateFlags: () => {
    const { songData } = get();
    if (songData) {
      const { wordFlags, alignment, flagCounts } = generateFlags(songData);
      set({ wordFlags, alignment, flagCounts });
    }
  },
  
  // Playback controls
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  
  // View controls
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
  setScrollPosition: (pos) => set({ scrollPosition: pos }),
  
  // Selection
  selectWord: (index, multi = false) => {
    const { selectedWordIndices } = get();
    if (multi) {
      if (selectedWordIndices.includes(index)) {
        set({ selectedWordIndices: selectedWordIndices.filter(i => i !== index) });
      } else {
        set({ selectedWordIndices: [...selectedWordIndices, index] });
      }
    } else {
      set({ selectedWordIndices: [index] });
    }
  },
  
  selectWordRange: (startIndex, endIndex) => {
    const indices = [];
    const min = Math.min(startIndex, endIndex);
    const max = Math.max(startIndex, endIndex);
    for (let i = min; i <= max; i++) {
      indices.push(i);
    }
    set({ selectedWordIndices: indices });
  },
  
  clearSelection: () => set({ selectedWordIndices: [], selectedPitchRange: null }),
  
  setSelectedPitchRange: (range) => set({ selectedPitchRange: range }),
  
  // Word editing
  updateWord: (index, updates) => {
    const { songData } = get();
    if (!songData || !songData.word_timings[index]) return;
    
    const newTimings = [...songData.word_timings];
    newTimings[index] = { ...newTimings[index], ...updates };
    
    set({
      songData: { ...songData, word_timings: newTimings },
      isDirty: true
    });
    
    get().regenerateFlags();
  },
  
  deleteWords: (indices) => {
    const { songData, wordTracks, wordFlags } = get();
    if (!songData) return;
    
    const indexSet = new Set(indices);
    const newTimings = songData.word_timings.filter((_, i) => !indexSet.has(i));
    
    // Rebuild word tracks with new indices
    const newWordTracks = {};
    let newIndex = 0;
    songData.word_timings.forEach((_, i) => {
      if (!indexSet.has(i)) {
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
      }
    });
    
    set({
      songData: { ...songData, word_timings: newTimings },
      wordTracks: newWordTracks,
      selectedWordIndices: [],
      isDirty: true
    });
    
    get().regenerateFlags();
  },
  
  moveWordsToTrack: (indices, track) => {
    const { wordTracks } = get();
    const newTracks = { ...wordTracks };
    indices.forEach(i => {
      newTracks[i] = track;
    });
    set({ wordTracks: newTracks, isDirty: true });
  },
  
  // Pitch editing
  setPitchForRange: (startTime, endTime, midiNote, noteName) => {
    const { songData } = get();
    if (!songData || !songData.pitch_data) return;
    
    const newPitchData = songData.pitch_data.map(p => {
      if (p.time >= startTime && p.time <= endTime) {
        return {
          ...p,
          midi_note: midiNote,
          note_name: noteName
        };
      }
      return p;
    });
    
    set({
      songData: { ...songData, pitch_data: newPitchData },
      isDirty: true
    });
  },
  
  clearPitchForRange: (startTime, endTime) => {
    const { songData } = get();
    if (!songData || !songData.pitch_data) return;
    
    const newPitchData = songData.pitch_data.map(p => {
      if (p.time >= startTime && p.time <= endTime) {
        return {
          ...p,
          midi_note: null,
          note_name: null
        };
      }
      return p;
    });
    
    set({
      songData: { ...songData, pitch_data: newPitchData },
      isDirty: true
    });
  },
  
  // Navigation
  goToNextFlag: () => {
    const { wordFlags, currentTime, songData } = get();
    if (!songData) return;
    
    for (let i = 0; i < wordFlags.length; i++) {
      if (wordFlags[i].length > 0) {
        const word = songData.word_timings[i];
        if (word.start > currentTime + 0.1) {
          set({ selectedWordIndices: [i] });
          return word.start;
        }
      }
    }
    
    // Wrap around
    for (let i = 0; i < wordFlags.length; i++) {
      if (wordFlags[i].length > 0) {
        const word = songData.word_timings[i];
        set({ selectedWordIndices: [i] });
        return word.start;
      }
    }
    
    return null;
  },
  
  goToPrevFlag: () => {
    const { wordFlags, currentTime, songData } = get();
    if (!songData) return;
    
    for (let i = wordFlags.length - 1; i >= 0; i--) {
      if (wordFlags[i].length > 0) {
        const word = songData.word_timings[i];
        if (word.start < currentTime - 0.1) {
          set({ selectedWordIndices: [i] });
          return word.start;
        }
      }
    }
    
    // Wrap around
    for (let i = wordFlags.length - 1; i >= 0; i--) {
      if (wordFlags[i].length > 0) {
        const word = songData.word_timings[i];
        set({ selectedWordIndices: [i] });
        return word.start;
      }
    }
    
    return null;
  },
  
  // View switching
  setCurrentView: (view) => set({ currentView: view }),
  toggleKaraokePreview: () => set(s => ({ showKaraokePreview: !s.showKaraokePreview })),
  
  // Go to next/prev song
  nextSong: async () => {
    const { songQueue, currentSongIndex, isDirty, saveSong, loadSong } = get();
    
    if (isDirty) {
      await saveSong();
    }
    
    if (currentSongIndex < songQueue.length - 1) {
      const nextIndex = currentSongIndex + 1;
      set({ currentSongIndex: nextIndex });
      await loadSong(songQueue[nextIndex]);
    }
  },
  
  prevSong: async () => {
    const { songQueue, currentSongIndex, isDirty, saveSong, loadSong } = get();
    
    if (isDirty) {
      await saveSong();
    }
    
    if (currentSongIndex > 0) {
      const prevIndex = currentSongIndex - 1;
      set({ currentSongIndex: prevIndex });
      await loadSong(songQueue[prevIndex]);
    }
  }
}));
