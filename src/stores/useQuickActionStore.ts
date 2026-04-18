import { create } from 'zustand'

export type QuickActionType = 'diary' | 'poop' | 'feed' | 'weight' | 'inventory' | 'health' | 'expiry' | null

interface QuickActionState {
    activeAction: QuickActionType
    openAction: (action: NonNullable<QuickActionType>) => void
    closeAction: () => void
}

export const useQuickActionStore = create<QuickActionState>((set) => ({
    activeAction: null,
    openAction: (action) => set({ activeAction: action }),
    closeAction: () => set({ activeAction: null }),
}))
