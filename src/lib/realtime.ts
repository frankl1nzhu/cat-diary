import { useEffect, useRef } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'

type TableName = string

/**
 * Subscribe to realtime changes on a Supabase table.
 * - Uses a ref for the callback to avoid stale closures.
 * - Debounces rapid-fire events to prevent redundant refetches.
 * - Automatically cleans up on unmount.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
    table: TableName,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
    filter?: string,
    debounceMs = 300,
) {
    // Keep a ref to the latest callback to avoid stale closures
    const callbackRef = useRef(callback)
    useEffect(() => {
        callbackRef.current = callback
    })

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const subscriptionConfig: {
            event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
            schema: string
            table: string
            filter?: string
        } = {
            event: '*',
            schema: 'public',
            table,
        }

        if (filter) {
            subscriptionConfig.filter = filter
        }

        const channel: RealtimeChannel = supabase
            .channel(`realtime-${table}-${filter || 'all'}`)
            .on(
                'postgres_changes' as any,
                subscriptionConfig,
                (payload: RealtimePostgresChangesPayload<T>) => {
                    // Debounce: if multiple events arrive quickly, only fire once
                    if (timeoutId) clearTimeout(timeoutId)
                    timeoutId = setTimeout(() => {
                        callbackRef.current(payload)
                    }, debounceMs)
                }
            )
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            supabase.removeChannel(channel)
        }
    }, [table, filter, debounceMs])
}
