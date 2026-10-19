/**
 * A page's title and preview picture (its og:image). Browsers can't read
 * another site's HTML (CORS), so this asks microlink.io, a public unfurl
 * service that only sees the link itself. Free tier: ~50 lookups a day.
 * Anything that goes wrong just means no preview — the link still works.
 */
export interface LinkMeta {
  title?: string
  image?: string
}

const ENDPOINT = 'https://api.microlink.io/'

function isHttp(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export function parseMicrolink(body: unknown): LinkMeta {
  if (!body || typeof body !== 'object') return {}
  const { status, data } = body as { status?: unknown; data?: { title?: unknown; image?: { url?: unknown } | null } }
  if (status !== 'success' || !data) return {}
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  const image = data.image?.url
  return { title: title || undefined, image: isHttp(image) ? image : undefined }
}

export async function fetchLinkMeta(href: string, timeoutMs = 8000): Promise<LinkMeta> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${ENDPOINT}?url=${encodeURIComponent(href)}`, { signal: controller.signal })
    if (!res.ok) return {}
    return parseMicrolink(await res.json())
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}
