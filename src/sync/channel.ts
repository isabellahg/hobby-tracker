import type { DataConnection } from 'peerjs'
import { isSyncMessage, type SyncMessage } from './protocol'

/**
 * A two-way pipe for sync messages. The protocol in `session.ts` doesn't care
 * whether it runs over PeerJS (web), a WebSocket to a desktop on the same wifi
 * (phone), or the desktop's own local server (bridged over Electron IPC).
 */
export interface SyncChannel {
  send(msg: SyncMessage): void
  /** Handlers are attached once, right after the channel is created. */
  onOpen(handler: () => void): void
  onMessage(handler: (msg: SyncMessage) => void): void
  onError(handler: (message: string) => void): void
  onClose(handler: () => void): void
  close(): void
}

export function peerChannel(conn: DataConnection): SyncChannel {
  return {
    send: (msg) => conn.send(msg),
    onOpen: (h) => conn.on('open', h),
    onMessage: (h) => conn.on('data', (data) => isSyncMessage(data) && h(data)),
    onError: (h) => conn.on('error', (err) => h(err.message)),
    onClose: (h) => conn.on('close', h),
    close: () => conn.close(),
  }
}

function parse(data: unknown): SyncMessage | null {
  if (typeof data !== 'string') return null
  try {
    const msg: unknown = JSON.parse(data)
    return isSyncMessage(msg) ? msg : null
  } catch {
    return null
  }
}

/** Phone → desktop: a plain WebSocket on the local network. */
export function webSocketChannel(socket: WebSocket): SyncChannel {
  return {
    send: (msg) => socket.send(JSON.stringify(msg)),
    onOpen: (h) => (socket.readyState === WebSocket.OPEN ? queueMicrotask(h) : socket.addEventListener('open', h)),
    onMessage: (h) =>
      socket.addEventListener('message', (e) => {
        const msg = parse(e.data)
        if (msg) h(msg)
      }),
    onError: (h) => socket.addEventListener('error', () => h('Lost the connection to the other device.')),
    onClose: (h) => socket.addEventListener('close', h),
    close: () => socket.close(),
  }
}

/**
 * Tries each address the desktop advertised until one answers — a desktop can
 * have several (wifi, ethernet, VPN) and only one is reachable from the phone.
 */
export function connectToDesktop(hosts: string[], port: number, code: string, timeoutMs = 4000): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const tryHost = (i: number) => {
      if (i >= hosts.length) {
        reject(new Error('Couldn’t reach the computer. Are both on the same wifi, and is its firewall letting the app through?'))
        return
      }
      const socket = new WebSocket(`ws://${hosts[i]}:${port}/?code=${encodeURIComponent(code)}`)
      const timer = window.setTimeout(() => {
        socket.close()
        tryHost(i + 1)
      }, timeoutMs)
      socket.addEventListener('open', () => {
        window.clearTimeout(timer)
        resolve(socket)
      })
      socket.addEventListener('error', () => {
        window.clearTimeout(timer)
        tryHost(i + 1)
      })
    }
    tryHost(0)
  })
}

/** Desktop host: the main process runs the server; messages come and go over IPC. */
export function desktopHostChannel(bridge: DesktopBridge): SyncChannel {
  const offs: (() => void)[] = []
  return {
    send: (msg) => bridge.lanSend(JSON.stringify(msg)),
    onOpen: (h) => offs.push(bridge.onLanConnected(h)),
    onMessage: (h) =>
      offs.push(
        bridge.onLanMessage((data) => {
          const msg = parse(data)
          if (msg) h(msg)
        }),
      ),
    onError: (h) => offs.push(bridge.onLanError(h)),
    onClose: (h) => offs.push(bridge.onLanClosed(h)),
    close: () => {
      offs.forEach((off) => off())
      bridge.lanStop()
    },
  }
}
