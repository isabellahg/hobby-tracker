import { describe, expect, it } from 'vitest'
import { decideDirection, deviceLabel, lanLink, newPairCode, parseLanTarget, parsePairCode } from './protocol'

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

describe('LAN targets', () => {
  it('round-trips the desktop QR', () => {
    const t = { hosts: ['192.168.1.5', '10.0.0.3'], port: 47321, code: 'ABC234' }
    expect(parseLanTarget(lanLink(t))).toEqual(t)
  })

  it('reads a typed address and code', () => {
    expect(parseLanTarget('192.168.1.5:47321 abc234')).toEqual({ hosts: ['192.168.1.5'], port: 47321, code: 'ABC234' })
  })

  it('rejects pair links and junk', () => {
    expect(parseLanTarget('https://x/#/sync?join=ABC234')).toBeNull()
    expect(parseLanTarget('hobbytracker://lan?h=nope&p=1&c=ABC234')).toBeNull()
  })
})
