# Karaoke Editor

A desktop application for editing word timings and pitch data for karaoke preparation. Built with Electron + React.

## Features

- **Batch Processing**: Scan folders recursively for JSON/MP3 pairs, with automatic flag generation for issues
- **Waveform Display**: Visualize and scrub through audio using wavesurfer.js
- **Word Timeline**: Two-track word editor with drag selection, visual flags for:
  - Text mismatches (orange)
  - Timing anomalies (red)
  - Overlapping words (purple)
  - Extra/unexpected words (yellow)
- **Pitch Editor**: Piano roll visualization with 88-key range
  - Click-drag to select time ranges
  - Click piano key to set pitch for selection
  - Delete key to clear pitch data
- **Karaoke Preview**: Live preview of lyrics with progressive highlighting
- **Keyboard Shortcuts**: Full keyboard navigation for efficient editing

## Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Usage

### 1. Select a Folder

Click "Select Folder" and choose a folder containing your `.json` and `.mp3` file pairs. The app will recursively scan for all matching pairs.

### 2. Review Flags

The queue shows all songs sorted alphabetically with flag counts. Click any song to open the editor.

### 3. Edit Words

- **Select**: Click on word blocks in the timeline
- **Multi-select**: Ctrl+Click or Shift+Click for ranges
- **Edit**: Double-click to open edit modal
- **Move tracks**: Right-click → Move to Lead/Harmony
- **Delete**: Press Delete key

### 4. Edit Pitch

- **Select range**: Click and drag in the pitch editor
- **Set note**: Click a key on the piano keyboard
- **Clear notes**: Press Delete with a selection

### 5. Navigate Flags

- **Tab**: Jump to next flagged word
- **Shift+Tab**: Jump to previous flagged word

### 6. Save

- **Ctrl+S**: Save current song
- Changes are saved in-place to the original JSON file

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| Tab | Next flag |
| Shift+Tab | Previous flag |
| Ctrl+S | Save |
| Delete | Delete selected words/pitch |
| Escape | Clear selection |
| Ctrl+Click | Multi-select |
| Shift+Click | Range select |

## JSON Data Format

The app expects JSON files with this structure:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "duration": 180.0,
  "lyrics_text": "Full lyrics text...",
  "word_timings": [
    {
      "word": "Hello",
      "start": 0.5,
      "end": 1.2,
      "speaker": null,
      "confidence": 0.95
    }
  ],
  "pitch_data": [
    {
      "time": 0.01,
      "frequency": 440.0,
      "midi_note": 69,
      "note_name": "A4"
    }
  ]
}
```

## Track System

- **Track 0 (Lead)**: Primary vocal track, used for karaoke preview
- **Track 1 (Harmony)**: Secondary track for backup vocals, harmonies

Words can be moved between tracks via right-click context menu.

## Flag Types

| Flag | Color | Description |
|------|-------|-------------|
| Text Mismatch | Orange | Word doesn't match lyrics |
| Timing Long | Red | Duration > 3 seconds |
| Timing Short | Red | Duration < 30ms |
| Overlap | Purple | Overlaps with next word |
| Extra Word | Yellow | Not found in lyrics |

## Development

The app uses:
- **Electron**: Desktop framework
- **React**: UI components
- **Vite**: Build tool
- **wavesurfer.js**: Audio visualization
- **Zustand**: State management
- **Canvas API**: Timeline and pitch editor rendering

### Project Structure

```
src/
├── main/
│   ├── main.js       # Electron main process
│   └── preload.js    # IPC bridge
└── renderer/
    ├── components/   # React components
    ├── utils/        # Alignment algorithm
    ├── store.js      # Zustand state
    ├── styles.css    # Global styles
    ├── App.jsx       # Main app component
    └── index.jsx     # Entry point
```

## License

MIT
