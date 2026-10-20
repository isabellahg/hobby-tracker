import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

const NO_CAMERA = 'No camera available — type the code instead.'

/** Camera view that reports the first QR code it can read. */
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(() => (navigator.mediaDevices ? null : NO_CAMERA))
  const onScanRef = useRef(onScan)
  useEffect(() => {
    onScanRef.current = onScan
  })

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: number | undefined
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    function tick() {
      const video = videoRef.current
      if (stopped || !video || !ctx) return
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
        if (found?.data) {
          onScanRef.current(found.data)
          return
        }
      }
      timer = window.setTimeout(tick, 200)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current!
        video.srcObject = s
        video.play().catch(() => undefined)
        tick()
      })
      .catch(() => setError(NO_CAMERA))

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (error) return <p className="muted small">{error}</p>
  return <video ref={videoRef} className="qr-video" muted playsInline aria-label="Camera, point it at the other device's QR code" />
}
