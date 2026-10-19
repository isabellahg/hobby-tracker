import { describe, expect, it } from 'vitest'
import { linkFromText, needsLookup, takePaste } from './attachments'
import { parseMicrolink } from './linkMeta'

function clipboard(text: string): DataTransfer {
  return { files: [] as unknown as FileList, getData: () => text } as unknown as DataTransfer
}

describe('linkFromText', () => {
  it('accepts a lone link, with or without https://', () => {
    expect(linkFromText('  https://youtu.be/abc  ')).toBe('https://youtu.be/abc')
    expect(linkFromText('www.artstation.com/x')).toBe('https://www.artstation.com/x')
  })

  it('leaves ordinary text alone', () => {
    expect(linkFromText('draw the dragon')).toBeNull()
    expect(linkFromText('see https://a.com for refs')).toBeNull()
    expect(linkFromText('notes.txt')).toBeNull()
  })
})

describe('takePaste', () => {
  it('takes over a pasted link and stops the normal paste', async () => {
    let prevented = false
    const taken = takePaste({ clipboardData: clipboard('https://a.com/b'), preventDefault: () => (prevented = true) })
    expect(prevented).toBe(true)
    expect(await taken).toEqual([{ kind: 'link', src: 'https://a.com/b' }])
  })

  it('lets ordinary text paste as usual', () => {
    let prevented = false
    expect(takePaste({ clipboardData: clipboard('hello'), preventDefault: () => (prevented = true) })).toBeNull()
    expect(prevented).toBe(false)
  })
})

describe('needsLookup', () => {
  it('looks up pages but not direct image links or ones already filled in', () => {
    expect(needsLookup({ kind: 'link', src: 'https://a.com/page' })).toBe(true)
    expect(needsLookup({ kind: 'link', src: 'https://a.com/pic.jpg' })).toBe(false)
    expect(needsLookup({ kind: 'link', src: 'https://a.com/page', preview: 'https://a.com/og.jpg' })).toBe(false)
  })
})

describe('parseMicrolink', () => {
  it('reads the title and picture', () => {
    expect(
      parseMicrolink({ status: 'success', data: { title: ' ArtStation ', image: { url: 'https://cdn.a.com/x.jpg' } } }),
    ).toEqual({ title: 'ArtStation', image: 'https://cdn.a.com/x.jpg' })
  })

  it('ignores failures and non-http pictures', () => {
    expect(parseMicrolink({ status: 'fail' })).toEqual({})
    expect(parseMicrolink({ status: 'success', data: { image: { url: 'data:x' } } })).toEqual({ title: undefined, image: undefined })
    expect(parseMicrolink(null)).toEqual({})
  })
})
