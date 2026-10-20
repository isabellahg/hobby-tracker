import Peer, { type DataConnection, type PeerError } from 'peerjs'
import { applyImport, exportAllData } from '../storage/exportImport'
import { metaRepo } from '../storage/repositories'
import { decideDirection, deviceLabel, isSyncMessage, newPairCode, type Direction, type SyncMessage } from './protocol'

/** Namespaces our codes on the shared public PeerJS pairing server. */
const PEER_PREFIX = 'hobbytracker-'

export type SyncPhase =
  | { phase: 'idle' }
  /** Showing a code/QR, waiting for the other device. */
  | { phase: 'waiting'; code: string }
  | { phase: 'connecting' }
  /** Connected; direction says which way the data would go. */
  | { phase: 'decide'; direction: Direction; mine: string | null; theirs: string | null; device: string }
  | { phase: 'transferring' }
  | { phase: 'done'; received: boolean }
  | { phase: 'error'; message: string }

function errorMessage(err: PeerError<string>): string {
  if (err.type === 'peer-unavailable') return 'No device is showing that code right now.'
  if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
    return 'Couldn’t reach the pairing server. Both devices need internet for the handshake.'
  }
  if (err.type === 'browser-incompatible') return 'This browser can’t do device-to-device connections.'
  return err.message || 'Something went wrong.'
}

/**
 * One pairing between two devices. The public server only introduces them;
 * the data itself goes straight from one device to the other (WebRTC), over
 * the local network when they share one.
 */
export class SyncSession {
  private peer: Peer | null = null
  private conn: DataConnection | null = null
  private closed = false

  private readonly onPhase: (phase: SyncPhase) => void
  /** Called after this device's data was replaced, to reload the app state. */
  private readonly onReplaced: () => Promise<void>

  constructor(onPhase: (phase: SyncPhase) => void, onReplaced: () => Promise<void>) {
    this.onPhase = onPhase
    this.onReplaced = onReplaced
  }

  /** Shows a fresh code and waits for the other device to join it. */
  host(): void {
    this.reset()
    const code = newPairCode()
    const peer = new Peer(PEER_PREFIX + code)
    this.peer = peer
    peer.on('open', () => this.onPhase({ phase: 'waiting', code }))
    peer.on('connection', (conn) => {
      if (this.conn) {
        conn.close()
        return
      }
      this.onPhase({ phase: 'connecting' })
      this.attach(conn)
    })
    peer.on('error', (err) => {
      // Someone else is using this code — just pick another.
      if (err.type === 'unavailable-id') this.host()
      else this.fail(errorMessage(err))
    })
  }

  join(code: string): void {
    this.reset()
    this.onPhase({ phase: 'connecting' })
    const peer = new Peer()
    this.peer = peer
    peer.on('open', () => this.attach(peer.connect(PEER_PREFIX + code, { reliable: true })))
    peer.on('error', (err) => this.fail(errorMessage(err)))
  }

  /** The older side agreed to be overwritten: ask for the data. */
  accept(): void {
    this.send({ type: 'request' })
    this.onPhase({ phase: 'transferring' })
  }

  close(): void {
    this.closed = true
    this.reset()
  }

  private reset(): void {
    this.conn?.close()
    this.peer?.destroy()
    this.conn = null
    this.peer = null
  }

  private fail(message: string): void {
    if (this.closed) return
    this.reset()
    this.onPhase({ phase: 'error', message })
  }

  private send(msg: SyncMessage): void {
    this.conn?.send(msg)
  }

  private attach(conn: DataConnection): void {
    this.conn = conn
    conn.on('open', async () => {
      this.send({ type: 'hello', changedAt: await metaRepo.getLastChangedAt(), device: deviceLabel(navigator.userAgent) })
    })
    conn.on('data', (data) => {
      if (isSyncMessage(data)) this.handle(data).catch((err) => this.fail(err instanceof Error ? err.message : String(err)))
    })
    conn.on('error', (err) => this.fail(err.message))
    conn.on('close', () => {
      if (this.conn === conn) this.conn = null
    })
  }

  private async handle(msg: SyncMessage): Promise<void> {
    if (msg.type === 'hello') {
      const mine = await metaRepo.getLastChangedAt()
      this.onPhase({ phase: 'decide', direction: decideDirection(mine, msg.changedAt), mine, theirs: msg.changedAt, device: msg.device })
    } else if (msg.type === 'request') {
      this.onPhase({ phase: 'transferring' })
      this.send({ type: 'data', changedAt: await metaRepo.getLastChangedAt(), export: await exportAllData() })
    } else if (msg.type === 'data') {
      await applyImport(msg.export, 'replace', msg.changedAt ?? new Date().toISOString())
      await this.onReplaced()
      this.send({ type: 'done' })
      this.onPhase({ phase: 'done', received: true })
    } else {
      this.onPhase({ phase: 'done', received: false })
    }
  }
}
