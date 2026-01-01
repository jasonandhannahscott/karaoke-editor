/**
 * Sequence alignment utilities for matching lyrics to word timings
 * Uses a modified Needleman-Wunsch algorithm
 */

// Normalize a word for comparison (lowercase, remove punctuation)
export function normalizeWord(word) {
  return word.toLowerCase().replace(/[^\w']/g, '');
}

// Calculate Levenshtein distance between two strings
export function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Calculate similarity ratio (0-1)
export function similarity(a, b) {
  const normA = normalizeWord(a);
  const normB = normalizeWord(b);
  
  if (normA === normB) return 1;
  if (!normA || !normB) return 0;
  
  const maxLen = Math.max(normA.length, normB.length);
  const distance = levenshteinDistance(normA, normB);
  
  return 1 - (distance / maxLen);
}

/**
 * Align lyrics text with word timings using dynamic programming
 * Returns an array of alignment results
 */
export function alignLyricsToTimings(lyricsText, wordTimings) {
  // Parse lyrics into words
  const lyricsWords = lyricsText
    .split(/\s+/)
    .filter(w => w.trim())
    .map((word, index) => ({ word, index }));
  
  const timingWords = wordTimings.map((timing, index) => ({
    ...timing,
    originalIndex: index
  }));
  
  const n = lyricsWords.length;
  const m = timingWords.length;
  
  // Score matrix
  const MATCH_SCORE = 2;
  const MISMATCH_SCORE = -1;
  const GAP_SCORE = -2;
  
  // Initialize DP matrix
  const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));
  const traceback = Array(n + 1).fill(null).map(() => Array(m + 1).fill(null));
  
  // Initialize first row and column
  for (let i = 1; i <= n; i++) {
    dp[i][0] = dp[i - 1][0] + GAP_SCORE;
    traceback[i][0] = 'up';
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = dp[0][j - 1] + GAP_SCORE;
    traceback[0][j] = 'left';
  }
  
  // Fill DP matrix
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(lyricsWords[i - 1].word, timingWords[j - 1].word);
      const matchScore = sim > 0.6 ? MATCH_SCORE * sim : MISMATCH_SCORE;
      
      const diagonal = dp[i - 1][j - 1] + matchScore;
      const up = dp[i - 1][j] + GAP_SCORE;
      const left = dp[i][j - 1] + GAP_SCORE;
      
      if (diagonal >= up && diagonal >= left) {
        dp[i][j] = diagonal;
        traceback[i][j] = 'diagonal';
      } else if (up >= left) {
        dp[i][j] = up;
        traceback[i][j] = 'up';
      } else {
        dp[i][j] = left;
        traceback[i][j] = 'left';
      }
    }
  }
  
  // Traceback to get alignment
  const alignment = [];
  let i = n, j = m;
  
  while (i > 0 || j > 0) {
    if (i === 0) {
      // Extra timing word (insertion)
      alignment.unshift({
        type: 'extra_timing',
        timingIndex: j - 1,
        timing: timingWords[j - 1],
        lyricWord: null
      });
      j--;
    } else if (j === 0) {
      // Missing timing word (deletion)
      alignment.unshift({
        type: 'missing_timing',
        lyricIndex: i - 1,
        lyricWord: lyricsWords[i - 1].word,
        timing: null
      });
      i--;
    } else if (traceback[i][j] === 'diagonal') {
      const sim = similarity(lyricsWords[i - 1].word, timingWords[j - 1].word);
      alignment.unshift({
        type: sim > 0.8 ? 'match' : 'mismatch',
        timingIndex: j - 1,
        lyricIndex: i - 1,
        timing: timingWords[j - 1],
        lyricWord: lyricsWords[i - 1].word,
        similarity: sim
      });
      i--;
      j--;
    } else if (traceback[i][j] === 'up') {
      alignment.unshift({
        type: 'missing_timing',
        lyricIndex: i - 1,
        lyricWord: lyricsWords[i - 1].word,
        timing: null
      });
      i--;
    } else {
      alignment.unshift({
        type: 'extra_timing',
        timingIndex: j - 1,
        timing: timingWords[j - 1],
        lyricWord: null
      });
      j--;
    }
  }
  
  return alignment;
}

/**
 * Generate flags for word timings based on alignment and timing analysis
 */
export function generateFlags(songData) {
  const { lyrics_text, word_timings, pitch_data } = songData;
  
  if (!word_timings || !lyrics_text) {
    return { wordFlags: [], pitchFlags: [], alignment: [] };
  }
  
  // Run alignment
  const alignment = alignLyricsToTimings(lyrics_text, word_timings);
  
  // Generate word flags
  const wordFlags = word_timings.map((timing, index) => {
    const flags = [];
    
    // Check for timing anomalies
    const duration = timing.end - timing.start;
    if (duration > 3) {
      flags.push({ type: 'timing_long', message: `Duration ${duration.toFixed(2)}s > 3s` });
    }
    if (duration < 0.03) {
      flags.push({ type: 'timing_short', message: `Duration ${(duration * 1000).toFixed(0)}ms < 30ms` });
    }
    
    // Check for overlaps with next word
    if (index < word_timings.length - 1) {
      const next = word_timings[index + 1];
      if (timing.end > next.start + 0.01) {
        flags.push({ type: 'overlap', message: `Overlaps with "${next.word}"` });
      }
    }
    
    return flags;
  });
  
  // Add alignment-based flags
  alignment.forEach(item => {
    if (item.type === 'mismatch' && item.timingIndex !== undefined) {
      wordFlags[item.timingIndex].push({
        type: 'text_mismatch',
        message: `Expected "${item.lyricWord}", got "${item.timing.word}"`,
        suggestedWord: item.lyricWord,
        similarity: item.similarity
      });
    } else if (item.type === 'extra_timing' && item.timingIndex !== undefined) {
      wordFlags[item.timingIndex].push({
        type: 'extra_word',
        message: `Extra word not in lyrics`
      });
    }
  });
  
  // Count total flags
  const flagCounts = {
    text_mismatch: 0,
    timing_long: 0,
    timing_short: 0,
    overlap: 0,
    extra_word: 0,
    missing_word: alignment.filter(a => a.type === 'missing_timing').length
  };
  
  wordFlags.forEach(flags => {
    flags.forEach(flag => {
      if (flagCounts[flag.type] !== undefined) {
        flagCounts[flag.type]++;
      }
    });
  });
  
  return {
    wordFlags,
    alignment,
    flagCounts,
    totalFlags: Object.values(flagCounts).reduce((a, b) => a + b, 0)
  };
}
