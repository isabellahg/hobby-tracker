/**
 * What can be previewed without a server. Page titles/descriptions need the
 * page's HTML, which browsers block cross-origin (CORS); thumbnails and
 * favicons are plain <img> loads and work fine.
 */
export type LinkPreview =
  | { kind: 'image'; src: string }
  | { kind: 'youtube'; videoId: string; thumbnail: string; href: string }
  | { kind: 'site'; href: string; host: string; path: string; favicon: string }

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\.|^m\./, '')
  if (host === 'youtu.be') return url.pathname.slice(1) || null
  if (host === 'youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v')
    const m = url.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
    if (m) return m[2]
  }
  return null
}

export function classifyLink(href: string): LinkPreview | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  if (IMAGE_EXT.test(url.pathname)) return { kind: 'image', src: url.href }

  const videoId = youtubeId(url)
  if (videoId) {
    return {
      kind: 'youtube',
      videoId,
      thumbnail: `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`,
      href: url.href,
    }
  }

  const path = url.pathname === '/' ? '' : decodeURIComponent(url.pathname)
  return {
    kind: 'site',
    href: url.href,
    host: url.hostname.replace(/^www\./, ''),
    path,
    favicon: `${url.origin}/favicon.ico`,
  }
}
