import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAppStore } from './useAppStore'
import { useAuthStore } from './useAuthStore'
import type { Cat, Family, FamilyMember } from '../types/database.types'

/* ─── Cat Store ──────────────────────────────────────
 *  Centralized cat & family data — replaces per-component
 *  queries from useCat(). Loaded once, shared everywhere.
 * ──────────────────────────────────────────────────── */

interface CatState {
    cats: Cat[]
    families: Family[]
    myRole: string
    loading: boolean
}

export const useCatStore = create<CatState>()(() => ({
    cats: [],
    families: [],
    myRole: 'member',
    loading: true,
}))

// Monotonic counter to cancel stale loads
let _loadVersion = 0

async function _loadCatData() {
    const version = ++_loadVersion
    const user = useAuthStore.getState().user
    const { activeFamilyId, currentCatId, setActiveFamilyId, setCurrentCatId } = useAppStore.getState()

    if (!user) {
        useCatStore.setState({ cats: [], families: [], myRole: 'member', loading: false })
        setCurrentCatId(null)
        setActiveFamilyId(null)
        return
    }

    useCatStore.setState({ loading: true })

    // 1. Load family memberships
    const { data: memberships } = await supabase
        .from('family_members')
        .select('family_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    if (version !== _loadVersion) return // stale

    const memberList = (memberships || []) as Pick<FamilyMember, 'family_id' | 'role'>[]
    if (memberList.length === 0) {
        useCatStore.setState({ cats: [], families: [], myRole: 'member', loading: false })
        return
    }

    // 2. Load family rows
    const familyIds = memberList.map((m) => m.family_id)
    const { data: familyRows } = await supabase
        .from('families')
        .select('*')
        .in('id', familyIds)
        .order('created_at', { ascending: true })

    if (version !== _loadVersion) return

    const fams = (familyRows || []) as Family[]

    // 3. Auto-resolve active family
    let resolvedFamilyId = activeFamilyId
    if (!resolvedFamilyId || !fams.some((f) => f.id === resolvedFamilyId)) {
        resolvedFamilyId = fams[0]?.id || null
        setActiveFamilyId(resolvedFamilyId)
    }

    // 4. Determine role in active family
    const membership = memberList.find((m) => m.family_id === resolvedFamilyId)
    const myRole = membership?.role || 'member'

    // 5. Load cats scoped to active family
    let catData: Cat[] = []
    if (resolvedFamilyId) {
        const { data } = await supabase
            .from('cats')
            .select('*')
            .eq('family_id', resolvedFamilyId)
            .order('created_at', { ascending: true })
        catData = (data || []) as Cat[]
    } else {
        const { data } = await supabase
            .from('cats')
            .select('*')
            .eq('created_by', user.id)
            .order('created_at', { ascending: true })
        catData = (data || []) as Cat[]
    }

    if (version !== _loadVersion) return

    // 6. Auto-select cat
    if (catData.length > 0) {
        const hasSelected = currentCatId && catData.some((c) => c.id === currentCatId)
        if (!hasSelected) {
            setCurrentCatId(catData[0].id)
        }
    } else {
        setCurrentCatId(null)
    }

    useCatStore.setState({ cats: catData, families: fams, myRole, loading: false })
}

/** Manually trigger a reload of cat/family data (e.g. after creating/deleting a cat). */
export function reloadCatData() {
    return _loadCatData()
}

/**
 * Initialize cat store subscriptions. Call once at app startup.
 * Reloads when auth user or activeFamilyId changes.
 * Returns a cleanup function.
 */
export function initCatStore(): () => void {
    let prevUserId: string | null | undefined = undefined
    let prevAuthLoading = true
    let prevActiveFamilyId: string | null | undefined = undefined

    // Subscribe to auth changes → reload when user changes
    const unsubAuth = useAuthStore.subscribe((state) => {
        const userId = state.user?.id ?? null
        const authLoading = state.loading
        if (userId !== prevUserId || (authLoading !== prevAuthLoading && !authLoading)) {
            prevUserId = userId
            prevAuthLoading = authLoading
            if (!authLoading) {
                _loadCatData()
            }
        }
    })

    // Subscribe to activeFamilyId changes → reload when family switches
    const unsubApp = useAppStore.subscribe((state) => {
        if (state.activeFamilyId !== prevActiveFamilyId) {
            prevActiveFamilyId = state.activeFamilyId
            // Only reload if auth is ready and user exists
            const { user, loading: authLoading } = useAuthStore.getState()
            if (!authLoading && user) {
                _loadCatData()
            }
        }
    })

    // Initial load if auth is already resolved
    const { loading: authLoading, user } = useAuthStore.getState()
    prevActiveFamilyId = useAppStore.getState().activeFamilyId
    prevUserId = user?.id ?? null
    prevAuthLoading = authLoading
    if (!authLoading) {
        _loadCatData()
    }

    return () => {
        unsubAuth()
        unsubApp()
    }
}
