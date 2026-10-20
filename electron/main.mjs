import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LanServer } from './lanServer.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(here, '..', 'dist')
/** Set to the Vite dev server (e.g. http://localhost:5173) to run against live code. */
const DEV_URL = process.env.ELECTRON_DEV_URL

// A fixed app:// origin keeps the local database in one place across launches.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

if (!app.requestSingleInstanceLock()) app.quit()

/** @type {BrowserWindow | null} */
let win = null

const lan = new LanServer({
  connected: () => win?.webContents.send('lan:connected'),
  message: (data) => win?.webContents.send('lan:message', data),
  error: (message) => win?.webContents.send('lan:error', message),
  closed: () => win?.webContents.send('lan:closed'),
})

ipcMain.handle('lan:start', (_e, code) => lan.start(String(code)))
ipcMain.on('lan:stop', () => lan.stop())
ipcMain.on('lan:send', (_e, data) => lan.send(String(data)))

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    backgroundColor: '#1e1e1e',
    autoHideMenuBar: true,
    title: 'Hobby Tracker',
    icon: path.join(DIST, 'pwa-512x512.png'),
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  })
  // Links (e.g. a task's attached page) open in the normal browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    lan.stop()
    win = null
  })
  win.loadURL(DEV_URL ?? 'app://hobby/index.html')
}

app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
