import http from 'node:http'
import os from 'node:os'
import { WebSocketServer } from 'ws'

/** Fixed so the OS firewall only has to allow it once; falls back to any free port. */
const PREFERRED_PORT = 47321
/** Gives up on a code nobody has used for this long. */
const IDLE_MS = 10 * 60 * 1000
/** Wrong codes allowed before the server stops listening. */
const MAX_BAD_CODES = 10

/** Private-network IPv4 addresses, the ones a phone on the same wifi can reach, best guesses first. */
export function lanAddresses() {
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3)
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => a.address)
  return [...new Set(ips)].sort((a, b) => rank(a) - rank(b))
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening)
      reject(err)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve(server.address().port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '0.0.0.0')
  })
}

/**
 * The desktop's sync server: one WebSocket client at a time, only with the
 * current code. It just relays messages — the app in the window does the sync.
 */
export class LanServer {
  /** @param {{ connected(): void, message(data: string): void, error(message: string): void, closed(): void }} events */
  constructor(events) {
    this.events = events
    this.server = null
    this.client = null
    this.code = null
    this.badCodes = 0
    this.idleTimer = null
  }

  async start(code) {
    this.stop()
    this.code = code
    this.badCodes = 0
    const server = http.createServer((_req, res) => {
      res.writeHead(404)
      res.end()
    })
    const wss = new WebSocketServer({ noServer: true, maxPayload: 512 * 1024 * 1024 })
    server.on('upgrade', (req, socket, head) => {
      const given = new URL(req.url ?? '/', 'http://local').searchParams.get('code')
      if (given !== this.code || this.client) {
        if (given !== this.code && ++this.badCodes >= MAX_BAD_CODES) this.stop()
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
        socket.destroy()
        return
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws))
    })
    let port
    try {
      port = await listen(server, PREFERRED_PORT)
    } catch {
      port = await listen(server, 0)
    }
    this.server = server
    this.idleTimer = setTimeout(() => this.stop(), IDLE_MS)
    return { hosts: lanAddresses(), port, code }
  }

  accept(ws) {
    clearTimeout(this.idleTimer)
    this.client = ws
    ws.on('message', (data) => this.events.message(data.toString()))
    ws.on('error', (err) => this.events.error(err.message))
    ws.on('close', () => {
      if (this.client === ws) this.client = null
      this.events.closed()
    })
    this.events.connected()
  }

  send(data) {
    this.client?.send(data)
  }

  stop() {
    clearTimeout(this.idleTimer)
    this.client?.close()
    this.client = null
    this.server?.close()
    this.server = null
    this.code = null
  }
}
