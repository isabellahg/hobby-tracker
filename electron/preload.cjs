// Sandboxed preload: CommonJS, and only `electron` can be required.
const { contextBridge, ipcRenderer } = require('electron')

/** Subscribes to a main-process event; returns the unsubscribe function. */
function on(channel) {
  return (handler) => {
    const listener = (_event, ...args) => handler(...args)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

// Shape mirrors `DesktopBridge` in src/desktop.d.ts.
contextBridge.exposeInMainWorld('desktop', {
  lanStart: (code) => ipcRenderer.invoke('lan:start', code),
  lanStop: () => ipcRenderer.send('lan:stop'),
  lanSend: (data) => ipcRenderer.send('lan:send', data),
  onLanConnected: on('lan:connected'),
  onLanMessage: on('lan:message'),
  onLanError: on('lan:error'),
  onLanClosed: on('lan:closed'),
})
