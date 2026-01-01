const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC Handlers

// Select folder dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// Recursively scan folder for JSON files with matching MP3s
ipcMain.handle('scan-folder', async (event, folderPath) => {
  const songs = [];
  
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        // Check for matching MP3
        const baseName = entry.name.slice(0, -5);
        const mp3Path = path.join(dir, baseName + '.mp3');
        
        if (fs.existsSync(mp3Path)) {
          try {
            const jsonContent = fs.readFileSync(fullPath, 'utf-8');
            const data = JSON.parse(jsonContent);
            
            songs.push({
              jsonPath: fullPath,
              mp3Path: mp3Path,
              fileName: baseName,
              title: data.title || baseName,
              artist: data.artist || 'Unknown',
              duration: data.duration || 0
            });
          } catch (err) {
            console.error(`Error reading ${fullPath}:`, err);
          }
        }
      }
    }
  }
  
  try {
    scanDir(folderPath);
    // Sort alphabetically by filename
    songs.sort((a, b) => a.fileName.localeCompare(b.fileName));
    return songs;
  } catch (err) {
    console.error('Error scanning folder:', err);
    return [];
  }
});

// Load song data
ipcMain.handle('load-song', async (event, jsonPath) => {
  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading song:', err);
    return null;
  }
});

// Save song data
ipcMain.handle('save-song', async (event, jsonPath, data) => {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving song:', err);
    return false;
  }
});

// Get file URL for audio playback
ipcMain.handle('get-file-url', async (event, filePath) => {
  return `file://${filePath.replace(/\\/g, '/')}`;
});

// Load audio file as base64 data URL
ipcMain.handle('load-audio-file', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `data:audio/mpeg;base64,${base64}`;
  } catch (err) {
    console.error('Error loading audio:', err);
    return null;
  }
});
