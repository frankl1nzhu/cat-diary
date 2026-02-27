import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAppStore } from '../stores/useAppStore'
import { useSession } from './auth'
import type { Cat, Family, FamilyMember } from '../types/database.types'

/**
 * Shared hook that loads cats scoped to the active family,
 * auto-resolves the active family if none is set,
 * and keeps `currentCatId` / `activeFamilyId` in sync with Zustand.
 */
export function useCat() {
    const { user, loading: authLoading } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const activeFamilyId = useAppStore((s) => s.activeFamilyId)
    const setActiveFamilyId = useAppStore((s) => s.setActiveFamilyId)
    const [cats, setCats] = useState<Cat[]>([])
    const [families, setFamilies] = useState<Family[]>([])
    const [myRole, setMyRole] = useState<string>('member')
    const [loading, setLoading] = useState(true)

    const loadFamilies = useCallback(async (userId: string) => {
        const { data: memberships } = await supabase
            .from('family_members')
            .select('family_id, role')
            .eq('user_id', userId)
            .order('created_at', { ascending: true })

        const memberList = (memberships || []) as Pick<FamilyMember, 'family_id' | 'role'>[]
        if (memberList.length === 0) return { families: [] as Family[], memberships: memberList }

        const familyIds = memberList.map((m) => m.family_id)
        const { data: familyRows } = await supabase
            .from('families')
            .select('*')
            .in('id', familyIds)
            .order('created_at', { ascending: true })

        return { families: (familyRows || []) as Family[], memberships: memberList }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function load() {
            if (authLoading) return

            if (!user) {
                setCats([])
                setFamilies([])
                setCurrentCatId(null)
                setActiveFamilyId(null)
                setLoading(false)
                return
            }

            setLoading(true)

            const { families: fams, memberships } = await loadFamilies(user.id)
            if (cancelled) return

            setFamilies(fams)

            // Auto-resolve active family
            let resolvedFamilyId = activeFamilyId
            if (!resolvedFamilyId || !fams.some((f) => f.id === resolvedFamilyId)) {
                resolvedFamilyId = fams[0]?.id || null
                setActiveFamilyId(resolvedFamilyId)
            }

            // Determine role in active family
            const membership = memberships.find((m) => m.family_id === resolvedFamilyId)
            setMyRole(membership?.role || 'member')

            // Load cats scoped to active family
            let catData: Cat[] = []
            if (resolvedFamilyId) {
                const { data } = await supabase
                    .from('cats')
                    .select('*')
                    .eq('family_id', resolvedFamilyId)
                    .order('created_at', { ascending: true })
                catData = (data || []) as Cat[]
            } else {
                // Fallback: personal cats without family
                const { data } = await supabase
                    .from('cats')
                    .select('*')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: true })
                catData = (data || []) as Cat[]
            }

            if (cancelled) return

            setCats(catData)

            if (catData.length > 0) {
                const hasSelected = currentCatId && catData.some((c) => c.id === currentCatId)
                if (!hasSelected) {
                    setCurrentCatId(catData[0].id)
                }
            } else {
                setCurrentCatId(null)
            }
            setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [authLoading, activeFamilyId, currentCatId, setCurrentCatId, setActiveFamilyId, user, loadFamilies])

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
