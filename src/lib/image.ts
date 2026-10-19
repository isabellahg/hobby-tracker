/**
 * Shrinks a picked photo so it can live in the local DB: longest side capped
 * at `maxDim`, re-encoded as JPEG. Phone photos (several MB) come out at a
 * few hundred KB.
 */
export async function downscaleImage(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the picture')
  // JPEG has no transparency; paint a background so transparent PNGs don't turn black.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}
