import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '../stores/useAppStore'
import { useCatStore } from '../stores/useCatStore'

/**
 * Shared hook — reads cat/family data from centralized stores.
 * All data is loaded once via initCatStore() at app startup.
 * No per-component Supabase queries or auth subscriptions.
 */
export function useCat() {
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const activeFamilyId = useAppStore((s) => s.activeFamilyId)
    const setActiveFamilyId = useAppStore((s) => s.setActiveFamilyId)

    const { cats, families, myRole, loading } = useCatStore(useShallow((s) => ({
        cats: s.cats,
        families: s.families,
        myRole: s.myRole,
        loading: s.loading,
    })))

    const resolvedCatId = currentCatId && cats.some((item) => item.id === currentCatId)
        ? currentCatId
        : (cats[0]?.id || null)

    const cat = cats.find((item) => item.id === resolvedCatId) || null

    return {
        cat,
        cats,
        catId: resolvedCatId,
        setCatId: setCurrentCatId,
        families,
        activeFamilyId,
        setActiveFamilyId,
        myRole,
        loading,
    }
}
