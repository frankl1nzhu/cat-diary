import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/* ─── App Store ──────────────────────────────────── */

interface AppStore {
    /** Currently selected cat ID, shared across pages via useCat hook */
    currentCatId: string | null
    setCurrentCatId: (id: string | null) => void
    /** Active family ID — scopes all cat queries */
    activeFamilyId: string | null
    setActiveFamilyId: (id: string | null) => void
}

export const useAppStore = create<AppStore>()(
    persist(
        (set) => ({
            currentCatId: null,
            setCurrentCatId: (id) => set({ currentCatId: id }),
            activeFamilyId: null,
            setActiveFamilyId: (id) => set({ activeFamilyId: id }),
        }),
        {
            name: 'cat-diary-app',
            partialize: (state) => ({
                currentCatId: state.currentCatId,
                activeFamilyId: state.activeFamilyId,
            }),
        },
    ),
)
