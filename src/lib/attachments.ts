import { downscaleImage } from './image'
import { classifyLink } from './linkPreview'

/** A picture or link that is about to be (or already is) attached to a task. */
export interface Attachment {
  kind: 'image' | 'link'
  src: string
  title?: string
  preview?: string
}

/** The link in a pasted string, if the paste is just one link (with or without https://). */
export function linkFromText(text: string): string | null {
  const t = text.trim()
  if (!t || /\s/.test(t)) return null
  const candidate = /^https?:\/\//i.test(t) ? t : /^www\./i.test(t) ? `https://${t}` : null
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

/** Direct image links already are their own preview; everything else is worth looking up. */
export function needsLookup(a: Attachment): boolean {
  return a.kind === 'link' && !a.preview && !a.title && classifyLink(a.src)?.kind !== 'image'
}

/**
 * Takes over a paste that carries pictures or a lone link. The decision is
 * synchronous so the normal paste can be stopped; the attachments arrive once
 * pictures are shrunk. Returns null for ordinary text, which pastes as usual.
 */
export function takePaste(e: { clipboardData: DataTransfer | null; preventDefault: () => void }): Promise<Attachment[]> | null {
  const data = e.clipboardData
  if (!data) return null

  const images = Array.from(data.files).filter((f) => f.type.startsWith('image/'))
  if (images.length > 0) {
    e.preventDefault()
    return Promise.all(
      images.map(async (file): Promise<Attachment> => {
        // Screenshots paste as "image.png" — not worth keeping as a title.
        const name = file.name.replace(/\.[^.]+$/, '')
        return { kind: 'image', src: await downscaleImage(file), title: name && name !== 'image' ? name : undefined }
      }),
    )
  }

  const href = linkFromText(data.getData('text'))
  if (href) {
    e.preventDefault()
    return Promise.resolve([{ kind: 'link', src: href }])
  }
  return null
}
