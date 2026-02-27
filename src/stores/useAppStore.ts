import { create } from 'zustand'

/* ─── App Store ──────────────────────────────────── */

interface AppStore {
    /** Currently selected cat ID, shared across pages via useCat hook */
    currentCatId: string | null
    setCurrentCatId: (id: string | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
    currentCatId: null,
    setCurrentCatId: (id) => set({ currentCatId: id }),
}))
