import { create } from 'zustand';
import { generateFlags } from './utils/alignment';

const MAX_HISTORY_SIZE = 50;

export const useStore = create((set, get) => ({
  // Folder/Queue state
  folderPath: null,
  songQueue: [],
  currentSongIndex: -1,
  
  // Queue filtering
  queueFilter: '',
  queueFilterMode: 'all', // 'all' | 'reviewed' | 'unreviewed' | 'flagged' | 'clean'
  
  // Song data
  songData: null,
  songPath: null,
  mp3Url: null,
  isDirty: false,
  
  // Reviewed tracking
  reviewedSongs: {}, // { [jsonPath]: boolean }
  
  // Flags
  wordFlags: [],
  alignment: [],
  flagCounts: {},
  
  // Playback state
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackSpeed: 1.0,
  
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
  
  // Autosave
  autosaveEnabled: true,
  lastSaveTime: null,
  
  // History for undo/redo
  history: [],
  historyIndex: -1,
  
  // History actions
  pushHistory: () => {
    const { songData, wordTracks, history, historyIndex } = get();
    if (!songData) return;
    
    // Create snapshot
    const snapshot = {
      word_timings: JSON.parse(JSON.stringify(songData.word_timings)),
      wordTracks: JSON.parse(JSON.stringify(wordTracks))
    };
    
    // Truncate any redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);
    
    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1
    });
  },
  
  undo: () => {
    const { history, historyIndex, songData } = get();
    if (historyIndex <= 0 || !songData) return;
    
    const prevSnapshot = history[historyIndex - 1];
    set({
      songData: { ...songData, word_timings: prevSnapshot.word_timings },
      wordTracks: prevSnapshot.wordTracks,
      historyIndex: historyIndex - 1,
      isDirty: true
    });
    get().regenerateFlags();
  },
  
  redo: () => {
    const { history, historyIndex, songData } = get();
    if (historyIndex >= history.length - 1 || !songData) return;
    
    const nextSnapshot = history[historyIndex + 1];
    set({
      songData: { ...songData, word_timings: nextSnapshot.word_timings },
      wordTracks: nextSnapshot.wordTracks,
      historyIndex: historyIndex + 1,
      isDirty: true
    });
    get().regenerateFlags();
  },
  
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
  
  clearHistory: () => {
    const { songData, wordTracks } = get();
    if (!songData) {
      set({ history: [], historyIndex: -1 });
      return;
    }
    
    // Initialize with current state
    const snapshot = {
      word_timings: JSON.parse(JSON.stringify(songData.word_timings)),
      wordTracks: JSON.parse(JSON.stringify(wordTracks))
    };
    set({ history: [snapshot], historyIndex: 0 });
  },
  
  // Actions
  setFolderPath: (path) => set({ folderPath: path }),
  
  setSongQueue: (queue) => set({ songQueue: queue }),
  
  setCurrentSongIndex: (index) => set({ currentSongIndex: index }),
  
  // Queue filter actions
  setQueueFilter: (filter) => set({ queueFilter: filter }),
  setQueueFilterMode: (mode) => set({ queueFilterMode: mode }),
  
  getFilteredQueue: () => {
    const { songQueue, queueFilter, queueFilterMode, reviewedSongs } = get();
    
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
    }
    // Note: 'flagged' and 'clean' modes are handled in QueueView with songFlags
    
    return filtered;
  },
  
  loadSong: async (song) => {
    console.log('loadSong called:', song.jsonPath);
    const data = await window.electronAPI.loadSong(song.jsonPath);
    console.log('Song data loaded:', data ? 'success' : 'failed', data ? `${data.word_timings?.length} words, ${data.pitch_data?.length} pitch points` : '');
    
    // Validate and sanitize the loaded data
    if (data) {
      // Helper to ensure a value is a primitive string
      const ensureString = (value, fallback) => {
        if (value === null || value === undefined) return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (Array.isArray(value)) return value.map(v => String(v)).join(', ');
        if (typeof value === 'object') {
          // Try common patterns like {en: "Title"} or {default: "Title"}
          if (value.en) return ensureString(value.en, fallback);
          if (value.default) return ensureString(value.default, fallback);
          if (value.name) return ensureString(value.name, fallback);
          return JSON.stringify(value);
        }
        return String(value);
      };
      
      // Sanitize critical string fields
      data.title = ensureString(data.title, song.fileName || 'Untitled');
      data.artist = ensureString(data.artist, 'Unknown Artist');
      
      console.log('Sanitized - title:', data.title, 'artist:', data.artist);
      
      // Validate required arrays exist
      if (!Array.isArray(data.word_timings)) {
        console.error('Invalid song data: word_timings is not an array');
        data.word_timings = [];
      }
      if (!Array.isArray(data.pitch_data)) {
        console.warn('No pitch_data array found, initializing empty');
        data.pitch_data = [];
      }
      
      // Ensure duration is a number
      if (typeof data.duration !== 'number') {
        data.duration = parseFloat(data.duration) || 0;
      }
      
      // Load reviewed status from file if present
      const reviewedSongs = get().reviewedSongs;
      if (data.reviewed !== undefined) {
        reviewedSongs[song.jsonPath] = !!data.reviewed;
      }
    }
    
    // Use file:// URL instead of loading entire file into memory
    const mp3Url = await window.electronAPI.getFileUrl(song.mp3Path);
    console.log('Audio URL:', mp3Url);
    
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
        currentView: 'editor',
        history: [],
        historyIndex: -1
      });
      
      // Initialize history with current state
      get().clearHistory();
      
      console.log('State updated, switching to editor view');
    }
  },
  
  saveSong: async () => {
    const { songPath, songData, wordTracks, reviewedSongs } = get();
    if (!songPath || !songData) return false;
    
    // Create backup first
    if (window.electronAPI.createBackup) {
      await window.electronAPI.createBackup(songPath);
    }
    
    // Add track info and reviewed status to save data
    const dataToSave = {
      ...songData,
      reviewed: reviewedSongs[songPath] || false,
      word_timings: songData.word_timings.map((timing, i) => ({
        ...timing,
        track: wordTracks[i] || 0
      }))
    };
    
    const success = await window.electronAPI.saveSong(songPath, dataToSave);
    if (success) {
      set({ isDirty: false, lastSaveTime: Date.now() });
    }
    return success;
  },
  
  // Reviewed tracking
  toggleReviewed: () => {
    const { songPath, reviewedSongs } = get();
    if (!songPath) return;
    
    const newReviewed = { ...reviewedSongs };
    newReviewed[songPath] = !newReviewed[songPath];
    set({ reviewedSongs: newReviewed, isDirty: true });
  },
  
  isReviewed: () => {
    const { songPath, reviewedSongs } = get();
    return songPath ? !!reviewedSongs[songPath] : false;
  },
  
  setReviewedForSong: (jsonPath, reviewed) => {
    const { reviewedSongs } = get();
    set({ reviewedSongs: { ...reviewedSongs, [jsonPath]: reviewed } });
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
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  // View controls
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(200, zoom)) }),
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
  
  // Keyboard navigation
  selectNextWord: () => {
    const { selectedWordIndices, songData } = get();
    if (!songData?.word_timings?.length) return;
    
    const maxIndex = songData.word_timings.length - 1;
    if (selectedWordIndices.length === 0) {
      set({ selectedWordIndices: [0] });
    } else {
      const lastSelected = Math.max(...selectedWordIndices);
      if (lastSelected < maxIndex) {
        set({ selectedWordIndices: [lastSelected + 1] });
      }
    }
  },
  
  selectPrevWord: () => {
    const { selectedWordIndices, songData } = get();
    if (!songData?.word_timings?.length) return;
    
    if (selectedWordIndices.length === 0) {
      set({ selectedWordIndices: [songData.word_timings.length - 1] });
    } else {
      const firstSelected = Math.min(...selectedWordIndices);
      if (firstSelected > 0) {
        set({ selectedWordIndices: [firstSelected - 1] });
      }
    }
  },
  
  // Get time range for selected words (for preview)
  getSelectedWordTimeRange: () => {
    const { selectedWordIndices, songData } = get();
    if (!songData?.word_timings || selectedWordIndices.length === 0) return null;
    
    const selectedWords = selectedWordIndices.map(i => songData.word_timings[i]).filter(Boolean);
    if (selectedWords.length === 0) return null;
    
    return {
      start: Math.min(...selectedWords.map(w => w.start)),
      end: Math.max(...selectedWords.map(w => w.end))
    };
  },
  
  // Word editing
  updateWord: (index, updates) => {
    const { songData } = get();
    if (!songData || !songData.word_timings[index]) return;
    
    get().pushHistory();
    
    const newTimings = [...songData.word_timings];
    newTimings[index] = { ...newTimings[index], ...updates };
    
    set({
      songData: { ...songData, word_timings: newTimings },
      isDirty: true
    });
    
    get().regenerateFlags();
  },
  
  // Update word without pushing history (for live dragging)
  updateWordNoHistory: (index, updates) => {
    const { songData } = get();
    if (!songData || !songData.word_timings[index]) return;
    
    const newTimings = [...songData.word_timings];
    newTimings[index] = { ...newTimings[index], ...updates };
    
    set({
      songData: { ...songData, word_timings: newTimings },
      isDirty: true
    });
  },
  
  // Finalize drag and regenerate flags
  finalizeDrag: () => {
    get().regenerateFlags();
  },
  
  deleteWords: (indices) => {
    const { songData, wordTracks, wordFlags } = get();
    if (!songData) return;
    
    get().pushHistory();
    
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
  
  // Merge consecutive words
  mergeWords: (indices) => {
    const { songData, wordTracks } = get();
    if (!songData || indices.length < 2) return;
    
    // Sort indices and verify they're consecutive
    const sortedIndices = [...indices].sort((a, b) => a - b);
    for (let i = 1; i < sortedIndices.length; i++) {
      if (sortedIndices[i] !== sortedIndices[i-1] + 1) {
        console.warn('Cannot merge non-consecutive words');
        return;
      }
    }
    
    get().pushHistory();
    
    const wordsToMerge = sortedIndices.map(i => songData.word_timings[i]);
    const mergedWord = {
      word: wordsToMerge.map(w => w.word).join(''),
      start: Math.min(...wordsToMerge.map(w => w.start)),
      end: Math.max(...wordsToMerge.map(w => w.end))
    };
    
    // Create new timings array
    const newTimings = [];
    const newWordTracks = {};
    let newIndex = 0;
    
    for (let i = 0; i < songData.word_timings.length; i++) {
      if (i === sortedIndices[0]) {
        // Insert merged word at first position
        newTimings.push(mergedWord);
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
      } else if (!sortedIndices.includes(i)) {
        // Keep other words
        newTimings.push(songData.word_timings[i]);
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
      }
    }
    
    set({
      songData: { ...songData, word_timings: newTimings },
      wordTracks: newWordTracks,
      selectedWordIndices: [sortedIndices[0]],
      isDirty: true
    });
    
    get().regenerateFlags();
  },
  
  // Split a word at a character position
  splitWord: (index, splitPosition) => {
    const { songData, wordTracks } = get();
    if (!songData || !songData.word_timings[index]) return;
    
    const word = songData.word_timings[index];
    if (splitPosition <= 0 || splitPosition >= word.word.length) return;
    
    get().pushHistory();
    
    // Calculate split time based on character position ratio
    const ratio = splitPosition / word.word.length;
    const splitTime = word.start + (word.end - word.start) * ratio;
    
    const firstPart = {
      word: word.word.substring(0, splitPosition),
      start: word.start,
      end: splitTime
    };
    
    const secondPart = {
      word: word.word.substring(splitPosition),
      start: splitTime,
      end: word.end
    };
    
    // Create new timings array
    const newTimings = [];
    const newWordTracks = {};
    let newIndex = 0;
    
    for (let i = 0; i < songData.word_timings.length; i++) {
      if (i === index) {
        // Insert both parts
        newTimings.push(firstPart);
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
        newTimings.push(secondPart);
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
      } else {
        newTimings.push(songData.word_timings[i]);
        newWordTracks[newIndex] = wordTracks[i] || 0;
        newIndex++;
      }
    }
    
    set({
      songData: { ...songData, word_timings: newTimings },
      wordTracks: newWordTracks,
      selectedWordIndices: [index, index + 1],
      isDirty: true
    });
    
    get().regenerateFlags();
  },
  
  // Auto-fix overlapping words
  autoFixOverlaps: () => {
    const { songData, wordFlags } = get();
    if (!songData) return 0;
    
    get().pushHistory();
    
    const newTimings = [...songData.word_timings];
    let fixCount = 0;
    
    for (let i = 0; i < wordFlags.length; i++) {
      const flags = wordFlags[i];
      if (flags.some(f => f.type === 'overlap')) {
        // Find the next word
        if (i + 1 < newTimings.length) {
          const nextWord = newTimings[i + 1];
          const currentWord = newTimings[i];
          
          // Adjust end time to 10ms before next word starts
          const newEndTime = nextWord.start - 0.01;
          
          // Ensure minimum duration of 30ms
          if (newEndTime - currentWord.start >= 0.03) {
            newTimings[i] = { ...currentWord, end: newEndTime };
            fixCount++;
          }
        }
      }
    }
    
    if (fixCount > 0) {
      set({
        songData: { ...songData, word_timings: newTimings },
        isDirty: true
      });
      get().regenerateFlags();
    }
    
    return fixCount;
  },
  
  moveWordsToTrack: (indices, track) => {
    const { wordTracks } = get();
    
    get().pushHistory();
    
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
  
  // Autosave
  toggleAutosave: () => set(s => ({ autosaveEnabled: !s.autosaveEnabled })),
  
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
