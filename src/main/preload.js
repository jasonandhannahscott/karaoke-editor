const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  scanSeparateFolders: (lyricsFolder, songsFolder) => ipcRenderer.invoke('scan-separate-folders', lyricsFolder, songsFolder),
  loadSong: (jsonPath) => ipcRenderer.invoke('load-song', jsonPath),
  saveSong: (jsonPath, data) => ipcRenderer.invoke('save-song', jsonPath, data),
  getFileUrl: (filePath) => ipcRenderer.invoke('get-file-url', filePath),
  loadAudioFile: (filePath) => ipcRenderer.invoke('load-audio-file', filePath),
  createBackup: (filePath) => ipcRenderer.invoke('create-backup', filePath)
});
