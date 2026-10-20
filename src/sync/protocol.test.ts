import { describe, expect, it } from 'vitest'
import { decideDirection, deviceLabel, newPairCode, parsePairCode } from './protocol'

describe('decideDirection', () => {
  it('sends when this device changed last', () => {
    expect(decideDirection('2026-10-20T10:00:00.000Z', '2026-10-19T10:00:00.000Z')).toBe('send')
    expect(decideDirection('2026-10-19T10:00:00.000Z', '2026-10-20T10:00:00.000Z')).toBe('receive')
  })

  it('treats a never-changed device as the older one', () => {
    expect(decideDirection(null, '2026-10-19T10:00:00.000Z')).toBe('receive')
    expect(decideDirection('2026-10-19T10:00:00.000Z', null)).toBe('send')
  })

  it('does nothing when both match', () => {
    expect(decideDirection(null, null)).toBe('equal')
    expect(decideDirection('2026-10-19T10:00:00.000Z', '2026-10-19T10:00:00.000Z')).toBe('equal')
  })
})

describe('pair codes', () => {
  it('round-trips through a join link and typed text', () => {
    const code = newPairCode()
    expect(parsePairCode(`https://x.github.io/hobby-tracker/#/sync?join=${code}`)).toBe(code)
    expect(parsePairCode(` ${code.toLowerCase()} `)).toBe(code)
  })

  it('rejects junk', () => {
    expect(parsePairCode('hello')).toBeNull()
    expect(parsePairCode('https://example.com')).toBeNull()
  })
})

describe('deviceLabel', () => {
  it('guesses phone vs computer', () => {
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) Mobile')).toBe('phone')
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('computer')
  })
})
