import { useEffect, useState } from 'react'

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Live-ticking elapsed time since `startedAt`, excluding any currently-open paused interval. */
export function DurationTimer({
  startedAt,
  pausedSec,
  isPaused,
}: {
  startedAt: string
  pausedSec: number
  isPaused: boolean
}) {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (isPaused) return
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [isPaused])

  const elapsedMs = Date.now() - new Date(startedAt).getTime()
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000) - pausedSec)

  return <span>{formatElapsed(totalSec)}</span>
}
