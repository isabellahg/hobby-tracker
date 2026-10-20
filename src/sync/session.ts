import Peer, { type PeerError } from 'peerjs'
import { applyImport, exportAllData } from '../storage/exportImport'
import { metaRepo } from '../storage/repositories'
import { connectToDesktop, desktopHostChannel, peerChannel, webSocketChannel, type SyncChannel } from './channel'
import {
  decideDirection,
  deviceLabel,
  newPairCode,
  type Direction,
  type LanTarget,
  type SyncMessage,
} from './protocol'

/** Namespaces our codes on the shared public PeerJS pairing server. */
const PEER_PREFIX = 'hobbytracker-'

export type SyncPhase =
  | { phase: 'idle' }
  /** Online pairing (web): showing a code/QR, waiting for the other device. */
  | { phase: 'waiting'; code: string }
  /** Desktop: local server up, waiting for a phone on the same wifi. */
  | { phase: 'waitingLan'; target: LanTarget }
  | { phase: 'connecting' }
  /** Connected; direction says which way the data would go. */
  | { phase: 'decide'; direction: Direction; mine: string | null; theirs: string | null; device: string }
  | { phase: 'transferring' }
  | { phase: 'done'; received: boolean }
  | { phase: 'error'; message: string }

function peerErrorMessage(err: PeerError<string>): string {
  if (err.type === 'peer-unavailable') return 'No device is showing that code right now.'
  if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
    return 'Couldn’t reach the pairing server. Both devices need internet for the handshake.'
  }
  if (err.type === 'browser-incompatible') return 'This browser can’t do device-to-device connections.'
  return err.message || 'Something went wrong.'
}

/**
 * One pairing between two devices, over whichever channel fits: the desktop's
 * local server (no internet at all), or PeerJS between two browsers.
 */
export class SyncSession {
  private peer: Peer | null = null
  private channel: SyncChannel | null = null
  private closed = false
  private readonly onPhase: (phase: SyncPhase) => void
  /** Called after this device's data was replaced, to reload the app state. */
  private readonly onReplaced: () => Promise<void>

  constructor(onPhase: (phase: SyncPhase) => void, onReplaced: () => Promise<void>) {
    this.onPhase = onPhase
    this.onReplaced = onReplaced
  }

  /** Desktop app: start the local server and wait for a phone. */
  async hostLan(bridge: DesktopBridge): Promise<void> {
    this.reset()
    this.attach(desktopHostChannel(bridge), () => this.onPhase({ phase: 'connecting' }))
    try {
      this.onPhase({ phase: 'waitingLan', target: await bridge.lanStart(newPairCode()) })
    } catch (err) {
      this.fail(err instanceof Error ? err.message : 'Couldn’t start the local sync server.')
    }
  }

  /** Phone: connect straight to the desktop on the same wifi. */
  async joinLan(target: LanTarget): Promise<void> {
    this.reset()
    this.onPhase({ phase: 'connecting' })
    try {
      const socket = await connectToDesktop(target.hosts, target.port, target.code)
      if (this.closed) {
        socket.close()
        return
      }
      this.attach(webSocketChannel(socket))
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err))
    }
  }

  /** Web: show a fresh code on the public pairing server and wait for the other device. */
  hostPeer(): void {
    this.reset()
    const code = newPairCode()
    const peer = new Peer(PEER_PREFIX + code)
    this.peer = peer
    peer.on('open', () => this.onPhase({ phase: 'waiting', code }))
    peer.on('connection', (conn) => {
      if (this.channel) {
        conn.close()
        return
      }
      this.onPhase({ phase: 'connecting' })
      this.attach(peerChannel(conn))
    })
    peer.on('error', (err) => {
      // Someone else is using this code — just pick another.
      if (err.type === 'unavailable-id') this.hostPeer()
      else this.fail(peerErrorMessage(err))
    })
  }

  joinPeer(code: string): void {
    this.reset()
    this.onPhase({ phase: 'connecting' })
    const peer = new Peer()
    this.peer = peer
    peer.on('open', () => this.attach(peerChannel(peer.connect(PEER_PREFIX + code, { reliable: true }))))
    peer.on('error', (err) => this.fail(peerErrorMessage(err)))
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
    this.channel?.close()
    this.peer?.destroy()
    this.channel = null
    this.peer = null
  }

  private fail(message: string): void {
    if (this.closed) return
    this.reset()
    this.onPhase({ phase: 'error', message })
  }

  private send(msg: SyncMessage): void {
    this.channel?.send(msg)
  }

  private attach(channel: SyncChannel, onOpen?: () => void): void {
    this.channel = channel
    channel.onOpen(async () => {
      onOpen?.()
      this.send({ type: 'hello', changedAt: await metaRepo.getLastChangedAt(), device: deviceLabel(navigator.userAgent) })
    })
    channel.onMessage((msg) => {
      this.handle(msg).catch((err) => this.fail(err instanceof Error ? err.message : String(err)))
    })
    channel.onError((message) => this.fail(message))
    channel.onClose(() => {
      if (this.channel === channel) this.channel = null
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
