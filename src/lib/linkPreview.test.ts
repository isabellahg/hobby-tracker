import { describe, expect, it } from 'vitest'
import { classifyLink } from './linkPreview'

describe('classifyLink', () => {
  it('recognises YouTube links in their common shapes', () => {
    for (const href of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      const p = classifyLink(href)
      expect(p?.kind).toBe('youtube')
      expect(p && p.kind === 'youtube' && p.videoId).toBe('dQw4w9WgXcQ')
    }
  })

  it('treats direct image URLs as images', () => {
    expect(classifyLink('https://example.com/ref/pose.JPG?w=800')?.kind).toBe('image')
  })

  it('falls back to a site card with host, path and favicon', () => {
    const p = classifyLink('https://www.artstation.com/artwork/abc')
    expect(p).toEqual({
      kind: 'site',
      href: 'https://www.artstation.com/artwork/abc',
      host: 'artstation.com',
      path: '/artwork/abc',
      favicon: 'https://www.artstation.com/favicon.ico',
    })
  })

  it('rejects non-http(s) and malformed links', () => {
    expect(classifyLink('javascript:alert(1)')).toBeNull()
    expect(classifyLink('not a url')).toBeNull()
  })
})
