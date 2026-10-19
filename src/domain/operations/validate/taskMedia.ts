import { z } from 'zod'

/** ~4 MB of base64 — far above a downscaled photo, but stops accidental huge pastes. */
const MAX_DATA_URL_LENGTH = 4_000_000

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/

export const taskAddMediaSchema = z
  .object({
    taskDefId: z.string().min(1),
    kind: z.enum(['image', 'link']),
    src: z.string().min(1),
    title: z.string().optional(),
    preview: z.string().refine(isHttpUrl, 'A preview must be an http(s) URL').optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'link' && !isHttpUrl(value.src)) {
      ctx.addIssue({ code: 'custom', path: ['src'], message: 'A link must be an http(s) URL' })
    }
    if (value.kind === 'image') {
      const ok = isHttpUrl(value.src) || IMAGE_DATA_URL.test(value.src)
      if (!ok) {
        ctx.addIssue({ code: 'custom', path: ['src'], message: 'A picture must be an http(s) URL or an image data URL' })
      } else if (value.src.length > MAX_DATA_URL_LENGTH) {
        ctx.addIssue({ code: 'custom', path: ['src'], message: 'That picture is too large' })
      }
    }
  })

export const taskRemoveMediaSchema = z.object({
  id: z.string().min(1),
})

export const taskUpdateMediaSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  preview: z.string().refine(isHttpUrl, 'A preview must be an http(s) URL').optional(),
})
