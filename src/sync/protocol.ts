import type { ExportedData } from '../storage/exportImport'

/**
 * Device-to-device sync with no merging: whichever side changed last wins
 * and replaces the other side's data wholesale.
 *
 * 1. Both sides send `hello` with when their data last changed.
 * 2. The older side asks the person, then sends `request`.
 * 3. The newer side answers with `data`; the older side replaces its data
 *    and replies `done`.
 */
export type SyncMessage =
  | { type: 'hello'; changedAt: string | null; device: string }
  | { type: 'request' }
  | { type: 'data'; changedAt: string | null; export: ExportedData }
  | { type: 'done' }

export type Direction = 'send' | 'receive' | 'equal'

/** A device that has never changed anything (null) is older than any that has. */
export function decideDirection(mine: string | null, theirs: string | null): Direction {
  if (mine === theirs) return 'equal'
  if (mine === null) return 'receive'
  if (theirs === null) return 'send'
  return mine > theirs ? 'send' : 'receive'
}

export function isSyncMessage(value: unknown): value is SyncMessage {
  const type = (value as { type?: unknown } | null)?.type
  return type === 'hello' || type === 'request' || type === 'data' || type === 'done'
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 6

/** Short, unambiguous (no O/0, I/1/L) code to type or show as a QR. */
export function newPairCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]
  return code
}

/** Pulls a pair code out of a scanned QR (a join link) or typed text; null when there isn't one. */
export function parsePairCode(text: string): string | null {
  const fromLink = /[?&]join=([A-Za-z0-9]+)/.exec(text)
  const raw = (fromLink ? fromLink[1] : text).trim().toUpperCase()
  return raw.length === CODE_LENGTH && [...raw].every((c) => CODE_ALPHABET.includes(c)) ? raw : null
}

/** Rough device label for "your phone is newer" prompts. */
export function deviceLabel(userAgent: string): string {
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet'
  if (/Android|iPhone|Mobile/i.test(userAgent)) return 'phone'
  return 'computer'
}

/** Where a desktop's local sync server listens: every address it has on the network, one port, one code. */
export interface LanTarget {
  hosts: string[]
  port: number
  code: string
}

/** What the desktop's QR code holds. */
export function lanLink(t: LanTarget): string {
  return `hobbytracker://lan?h=${t.hosts.join(',')}&p=${t.port}&c=${t.code}`
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** Reads a scanned desktop QR, or a typed "192.168.1.5:47321 ABC234". */
export function parseLanTarget(text: string): LanTarget | null {
  const link = /^hobbytracker:\/\/lan\?(.*)$/.exec(text.trim())
  if (link) {
    const params = new URLSearchParams(link[1])
    const hosts = (params.get('h') ?? '').split(',').filter((h) => IPV4.test(h))
    const port = Number(params.get('p'))
    const code = parsePairCode(params.get('c') ?? '')
    return hosts.length > 0 && Number.isInteger(port) && port > 0 && code ? { hosts, port, code } : null
  }
  const typed = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})\s+(\S+)$/.exec(text.trim())
  if (!typed) return null
  const code = parsePairCode(typed[3])
  return code ? { hosts: [typed[1]], port: Number(typed[2]), code } : null
}
