import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { useAppStore } from '../stores/useAppStore'
import type { Cat } from '../types/database.types'

/**
 * Shared hook that loads the first (currently only) cat from Supabase
 * and keeps `currentCatId` in sync with the Zustand store.
 *
 * Returns the full Cat row so pages don't need their own cat query.
 */
export function useCat() {
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const [cat, setCat] = useState<Cat | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            const { data } = await supabase
                .from('cats')
                .select('*')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            if (cancelled) return

            if (data) {
                setCat(data)
                setCurrentCatId(data.id)
            }
            setLoading(false)
        }

        load()
        return () => { cancelled = true }
    }, [setCurrentCatId])

    return { cat, catId: currentCatId, loading }
}
