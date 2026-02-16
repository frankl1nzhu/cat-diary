import { create } from 'zustand'
import type { FeedStatusType, InventoryStatus } from '../types/database.types'

/* ─── Feed Status Slice ──────────────────────────── */

interface FeedStatusState {
    status: FeedStatusType
    fedBy: string | null
    fedAt: string | null
    setFeedStatus: (status: FeedStatusType, fedBy?: string | null, fedAt?: string | null) => void
}

/* ─── Inventory Slice ────────────────────────────── */

interface InventoryItemState {
    name: string
    status: InventoryStatus
}

interface InventoryState {
    items: InventoryItemState[]
    setItems: (items: InventoryItemState[]) => void
    updateItem: (name: string, status: InventoryStatus) => void
}

/* ─── Cat Selection Slice ────────────────────────── */

interface CatState {
    currentCatId: string | null
    setCurrentCatId: (id: string | null) => void
}

/* ─── Combined Store ─────────────────────────────── */

interface AppStore extends FeedStatusState, InventoryState, CatState { }

export const useAppStore = create<AppStore>((set) => ({
    // Feed status
    status: 'not_fed',
    fedBy: null,
    fedAt: null,
    setFeedStatus: (status, fedBy = null, fedAt = null) =>
        set({ status, fedBy, fedAt }),

    // Inventory
    items: [],
    setItems: (items) => set({ items }),
    updateItem: (name, status) =>
        set((state) => ({
            items: state.items.map((item) =>
                item.name === name ? { ...item, status } : item
            ),
        })),

    // Cat selection
    currentCatId: null,
    setCurrentCatId: (id) => set({ currentCatId: id }),
}))
