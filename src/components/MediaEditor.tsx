import { useRef, useState } from 'react'
import { downscaleImage } from '../lib/image'
import { saveAttachment } from '../state/attachments'
import { MediaStrip } from './MediaStrip'

/** A task's pictures and links. Links arrive by pasting (see TaskEditor); pictures by paste or this picker. */
export function MediaEditor({ taskDefId }: { taskDefId: string }) {
  const [busy, setBusy] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function addPictures(files: FileList | null) {
    if (!files || files.length === 0) return
    setBusy(true)
    setPickError(null)
    try {
      for (const file of Array.from(files)) {
        const src = await downscaleImage(file)
        await saveAttachment(taskDefId, { kind: 'image', src, title: file.name.replace(/\.[^.]+$/, '') })
      }
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Could not add that picture')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="field">
      <label>Pictures & links</label>
      <MediaStrip taskDefId={taskDefId} removable />
      <div className="row">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addPictures(e.target.files)}
        />
        <button type="button" className="btn" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? 'Adding…' : '+ Picture'}
        </button>
        <span className="field-hint">Paste a link or picture into any field — it's attached with a preview.</span>
      </div>
      {pickError && <p className="error">{pickError}</p>}
    </div>
  )
}
