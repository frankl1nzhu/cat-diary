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
    const [cats, setCats] = useState<Cat[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            const { data } = await supabase
                .from('cats')
                .select('*')
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
    }, [currentCatId, setCurrentCatId])

    const cat = cats.find((item) => item.id === currentCatId) || null

    return {
        cat,
        cats,
        catId: currentCatId,
        setCatId: setCurrentCatId,
        loading,
    }
}
