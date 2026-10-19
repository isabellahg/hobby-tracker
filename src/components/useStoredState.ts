import { useState } from 'react'

/**
 * useState that survives reloads, for view preferences only (sort order,
 * compact mode…). Stored per browser; if storage is unavailable it quietly
 * falls back to the default.
 */
export function useStoredState<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? { ...initial, ...(JSON.parse(raw) as Partial<T>) } : initial
    } catch {
      return initial
    }
  })

  function update(patch: Partial<T>) {
    setValue((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Private mode / blocked storage: the preference just won't stick.
      }
      return next
    })
  }

  return [value, update]
}
