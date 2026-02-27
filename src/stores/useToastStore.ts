import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
    id: string
    type: ToastType
    message: string
}

interface ToastState {
    items: ToastItem[]
    pushToast: (type: ToastType, message: string, durationMs?: number) => void
    removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
    items: [],
    pushToast: (type, message, durationMs = 2800) => {
        const id = crypto.randomUUID()
        set((state) => ({
            items: [...state.items, { id, type, message }],
        }))

        window.setTimeout(() => {
            get().removeToast(id)
        }, durationMs)
    },
    removeToast: (id) => {
        set((state) => ({
            items: state.items.filter((item) => item.id !== id),
        }))
    },
}))
