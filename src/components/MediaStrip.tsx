import { useState } from 'react'
import { useAppStore } from '../state/store'
import { run } from '../state/actions'
import { classifyLink } from '../lib/linkPreview'
import type { Attachment } from '../lib/attachments'

function RemoveButton({ kind, onRemove }: { kind: Attachment['kind']; onRemove: () => void }) {
  return (
    <button
      type="button"
      className="media-remove"
      aria-label={kind === 'image' ? 'Remove picture' : 'Remove link'}
      title="Remove"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onRemove()
      }}
    >
      ×
    </button>
  )
}

function Favicon({ src }: { src: string }) {
  return (
    <img
      className="media-favicon"
      src={src}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
      }}
    />
  )
}

function MediaTile({
  media,
  onRemove,
  onOpenImage,
}: {
  media: Attachment
  onRemove?: () => void
  onOpenImage: (src: string, title?: string) => void
}) {
  const [previewBroken, setPreviewBroken] = useState(false)
  const remove = onRemove ? <RemoveButton kind={media.kind} onRemove={onRemove} /> : null
  const link = media.kind === 'link' ? classifyLink(media.src) : null
  const imageSrc = media.kind === 'image' ? media.src : link?.kind === 'image' ? link.src : null

  if (imageSrc) {
    return (
      <div className="media-tile">
        <button
          type="button"
          className="media-thumb"
          aria-label={`Open ${media.title ?? 'picture'}`}
          onClick={() => onOpenImage(imageSrc, media.title)}
        >
          <img src={imageSrc} alt={media.title ?? ''} loading="lazy" />
        </button>
        {remove}
      </div>
    )
  }
  if (!link || link.kind === 'image') return null

  const picture = media.preview && !previewBroken ? media.preview : link.kind === 'youtube' ? link.thumbnail : null
  const host = link.kind === 'site' ? link.host : 'youtube.com'
  const favicon = link.kind === 'site' ? link.favicon : 'https://www.youtube.com/favicon.ico'

  // A card with the page's picture, once the lookup has found one.
  if (picture) {
    return (
      <div className="media-tile">
        <a className="media-card" href={link.href} target="_blank" rel="noopener noreferrer">
          <span className="media-card-img">
            <img src={picture} alt="" loading="lazy" onError={() => setPreviewBroken(true)} />
            {link.kind === 'youtube' && (
              <span className="media-play" aria-hidden="true">
                ▶
              </span>
            )}
          </span>
          <span className="media-card-text">
            <span className="media-link-title">{media.title ?? host}</span>
            <span className="media-link-path">
              <Favicon src={favicon} />
              {host}
            </span>
          </span>
        </a>
        {remove}
      </div>
    )
  }

  return (
    <div className="media-tile media-tile-wide">
      <a className="media-link" href={link.href} target="_blank" rel="noopener noreferrer">
        <Favicon src={favicon} />
        <span className="media-link-text">
          <span className="media-link-title">{media.title ?? host}</span>
          <span className="media-link-path">{link.kind === 'site' && media.title ? host + link.path : link.kind === 'site' ? link.path : ''}</span>
        </span>
      </a>
      {remove}
    </div>
  )
}

/** A row of attachment tiles with a lightbox for pictures. */
export function MediaList({ items, onRemove }: { items: Attachment[]; onRemove?: (index: number) => void }) {
  const [open, setOpen] = useState<{ src: string; title?: string } | null>(null)
  if (items.length === 0) return null
  return (
    <>
      <div className="media-strip" onClick={(e) => e.stopPropagation()}>
        {items.map((m, i) => (
          <MediaTile
            key={(m as { id?: string }).id ?? `${i}-${m.src.slice(-40)}`}
            media={m}
            onRemove={onRemove && (() => onRemove(i))}
            onOpenImage={(src, title) => setOpen({ src, title })}
          />
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={open.title ?? 'Picture'} className="lightbox" onClick={() => setOpen(null)}>
          <img src={open.src} alt={open.title ?? ''} />
          <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setOpen(null)}>
            ×
          </button>
        </div>
      )}
    </>
  )
}

/** Pictures and links attached to a task. Renders nothing when there are none. */
export function MediaStrip({ taskDefId, removable = false }: { taskDefId?: string; removable?: boolean }) {
  const allMedia = useAppStore((s) => s.taskMedia)
  if (!taskDefId) return null
  const media = allMedia.filter((m) => m.taskDefId === taskDefId)
  return (
    <MediaList
      items={media}
      onRemove={
        removable ? (i) => run({ operation: 'taskDef.removeMedia', payload: { id: media[i].id } }) : undefined
      }
    />
  )
}
