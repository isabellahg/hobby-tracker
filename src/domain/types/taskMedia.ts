import type { ID, ISODateTimeString } from './common'

export type MediaKind = 'image' | 'link'

/**
 * A picture or link attached to a task. Uploaded pictures are stored inline
 * as (downscaled) data URLs so they live in the local DB and survive
 * export/import like everything else.
 */
export interface TaskMedia {
  id: ID
  taskDefId: ID
  kind: MediaKind
  src: string
  title?: string
  /** For links: the page's preview picture (og:image), fetched when the link is pasted. */
  preview?: string
  createdAt: ISODateTimeString
}
