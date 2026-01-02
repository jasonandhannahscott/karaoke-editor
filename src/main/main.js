const { app, BrowserWindow, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Check if we have a built dist folder
const distPath = path.join(__dirname, '../../dist/index.html');
const hasDistBuild = fs.existsSync(distPath);

console.log('Mode:', isDev ? 'development' : 'production');
console.log('Dist build exists:', hasDistBuild);

// Log all uncaught exceptions in main process
process.on('uncaughtException', (error) => {
  console.error('MAIN PROCESS UNCAUGHT EXCEPTION:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('MAIN PROCESS UNHANDLED REJECTION:', reason);
});

// Register custom protocol as privileged BEFORE app is ready
// This allows fetch() to work with the protocol
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'local-audio', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true,
      stream: true
    } 
  }
]);

// Install React DevTools in dev mode
async function installDevTools() {
  if (isDev) {
    try {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = require('electron-devtools-installer');
      await installExtension(REACT_DEVELOPER_TOOLS);
      console.log('React DevTools installed');
    } catch (err) {
      console.log('Failed to install React DevTools:', err);
    }
  }
}

// Register custom protocol for serving local files
app.whenReady().then(async () => {
  // Install React DevTools first
  await installDevTools();
  
  // Register protocol to serve local audio files
  protocol.registerFileProtocol('local-audio', (request, callback) => {
    try {
      // URL format: local-audio://file/BASE64_ENCODED_PATH
      const encoded = request.url.replace('local-audio://file/', '');
      const filePath = Buffer.from(encoded, 'base64').toString('utf-8');
      console.log('Serving audio file:', filePath);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error('Audio file not found:', filePath);
        callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
        return;
      }
      
      callback({ path: filePath });
    } catch (err) {
      console.error('Protocol handler error:', err);
      callback({ error: -2 }); // net::ERR_FAILED
    }
  });
  
  createWindow();
});

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

  if (isDev && !hasDistBuild) {
    // Dev mode - load from Vite dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
    
    // Forward renderer console to main process terminal
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelName = ['LOG', 'WARN', 'ERROR'][level] || 'INFO';
      console.log(`[RENDERER ${levelName}] ${message}`);
    });
  } else {
    // Production mode - load from dist folder
    console.log('Loading from:', distPath);
    mainWindow.loadFile(distPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Log renderer crashes
  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('RENDERER CRASHED! killed:', killed);
  });
  
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('RENDERER PROCESS GONE:', details);
  });
  
  mainWindow.webContents.on('unresponsive', () => {
    console.error('RENDERER UNRESPONSIVE');
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('FAILED TO LOAD:', errorCode, errorDescription);
  });
}

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
            
            // Safely extract string values
            const safeString = (val, fallback) => {
              if (val === null || val === undefined) return fallback;
              if (typeof val === 'string') return val;
              if (typeof val === 'number') return String(val);
              if (Array.isArray(val)) return val.join(', ');
              if (typeof val === 'object') return JSON.stringify(val);
              return String(val);
            };
            
            songs.push({
              jsonPath: fullPath,
              mp3Path: mp3Path,
              fileName: baseName,
              title: safeString(data.title, baseName),
              artist: safeString(data.artist, 'Unknown'),
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

// Get file URL for audio playback using custom protocol
ipcMain.handle('get-file-url', async (event, filePath) => {
  console.log('get-file-url called with:', filePath);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('Audio file does not exist:', filePath);
    return null;
  }
  
  // Base64 encode the path to avoid URL parsing issues with Windows paths
  const encoded = Buffer.from(filePath, 'utf-8').toString('base64');
  const url = `local-audio://file/${encoded}`;
  console.log('Generated URL:', url);
  return url;
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
