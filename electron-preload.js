const { contextBridge, ipcRenderer } = require('electron');

// Exposes secure, scoped APIs to the renderer (React frontend)
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  sendNotification: (title, options) => ipcRenderer.send('notify', { title, options }),
  updateUnreadCount: (count) => ipcRenderer.send('update-badge', count),
  saveUrl: (url) => ipcRenderer.send('save-url', url),
  testUrl: (url) => ipcRenderer.invoke('test-url', url),
  getSavedUrl: () => ipcRenderer.invoke('get-saved-url'),
  getMediaDevices: () => ipcRenderer.invoke('get-media-devices'),
  requestMediaPermission: (constraints) => ipcRenderer.invoke('media:request-permission', constraints),
});
