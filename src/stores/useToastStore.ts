import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
    id: string
    type: ToastType
    message: string
    durationMs: number
}

interface ToastState {
    items: ToastItem[]
    pushToast: (type: ToastType, message: string, durationMs?: number) => void
    removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
    items: [],
    pushToast: (type, message, durationMs) => {
        const id = crypto.randomUUID()
        // Auto-extend duration for longer messages
        const duration = durationMs ?? (message.length > 20 ? 3500 : 2800)

        set((state) => {
            // Limit concurrent toasts to 3 — drop oldest when exceeding
            const current = state.items.length >= 3 ? state.items.slice(-2) : state.items
            return {
                items: [...current, { id, type, message, durationMs: duration }],
            }
        })

        window.setTimeout(() => {
            get().removeToast(id)
        }, duration)
    },
    removeToast: (id) => {
        set((state) => ({
            items: state.items.filter((item) => item.id !== id),
        }))
    },
}))
