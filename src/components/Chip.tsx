import type { ReactNode } from 'react'

/** hobby = amber, skill = violet, plain = neutral grey (task kind, ad-hoc, timers). */
export type ChipTone = 'plain' | 'hobby' | 'skill'

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: ChipTone }) {
  return <span className={tone === 'plain' ? 'chip' : `chip chip-${tone}`}>{children}</span>
}
