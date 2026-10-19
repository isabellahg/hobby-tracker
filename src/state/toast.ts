import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  /** Optional in-app link, e.g. to the session something was logged in. */
  link?: { to: string; label: string }
  tone?: 'error'
}

interface ToastState {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let nextId = 1

/** Short-lived confirmations for actions that change something out of view. */
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-3) })
    setTimeout(() => get().dismiss(id), 5000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))
