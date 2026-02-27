import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useAppStore } from '../stores/useAppStore'
import { useSession } from './auth'
import type { Cat } from '../types/database.types'

/**
 * Shared hook that loads the first (currently only) cat from Supabase
 * and keeps `currentCatId` in sync with the Zustand store.
 *
 * Returns the full Cat row so pages don't need their own cat query.
 */
export function useCat() {
    const { user, loading: authLoading } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const [cats, setCats] = useState<Cat[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            if (authLoading) {
                return
            }

            if (!user) {
                setCats([])
                setCurrentCatId(null)
                setLoading(false)
                return
            }

            setLoading(true)

            const { data: memberships } = await supabase
                .from('family_members')
                .select('family_id')
                .eq('user_id', user.id)

            const familyIds = (memberships || []).map((item) => item.family_id)

            const { data } = familyIds.length > 0
                ? await supabase
                    .from('cats')
                    .select('*')
                    .or(`family_id.in.(${familyIds.join(',')}),and(created_by.eq.${user.id},family_id.is.null)`)
                    .order('created_at', { ascending: true })
                : await supabase
                    .from('cats')
                    .select('*')
                    .eq('created_by', user.id)
                    .order('created_at', { ascending: true })

            if (cancelled) return

            const list = data || []
            setCats(list)

            if (list.length > 0) {
                const hasSelected = currentCatId && list.some((item) => item.id === currentCatId)
                if (!hasSelected) {
                    setCurrentCatId(list[0].id)
                }
            } else {
                setCurrentCatId(null)
            }
            setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [authLoading, currentCatId, setCurrentCatId, user])

    const cat = cats.find((item) => item.id === currentCatId) || null

    return {
        cat,
        cats,
        catId: currentCatId,
        setCatId: setCurrentCatId,
        loading,
    }
}
