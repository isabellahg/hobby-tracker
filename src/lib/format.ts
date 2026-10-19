export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return sec > 0 ? `${sec}s` : '0m'
}

/** Fits a calendar cell: "45m", "2h", "1.5h". */
export function compactDuration(sec: number): string {
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  const h = Math.round((sec / 3600) * 10) / 10
  return `${h}h`
}
