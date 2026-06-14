const { contextBridge, ipcRenderer } = require('electron');

// Exposes secure, scoped APIs to the renderer (React frontend)
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  sendNotification: (title, options) => ipcRenderer.send('notify', { title, options }),
  updateUnreadCount: (count) => ipcRenderer.send('update-badge', count),
  getMediaDevices: () => ipcRenderer.invoke('get-media-devices'),
  requestMediaPermission: (constraints) => ipcRenderer.invoke('media:request-permission', constraints),
});
