const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('repopilot', {
  invoke: (channel, body) => ipcRenderer.invoke('repopilot', channel, body),
});
