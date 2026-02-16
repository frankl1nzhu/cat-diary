import { useEffect } from 'react'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'

type TableName = string

/**
 * Subscribe to realtime changes on a Supabase table.
 * Automatically cleans up on unmount.
 */
export function useRealtimeSubscription<T extends Record<string, unknown>>(
    table: TableName,
    callback: (payload: RealtimePostgresChangesPayload<T>) => void,
    filter?: string
) {
    useEffect(() => {
        let channel: RealtimeChannel

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

        channel = supabase
            .channel(`realtime-${table}`)
            .on(
                'postgres_changes' as never,
                subscriptionConfig,
                (payload: RealtimePostgresChangesPayload<T>) => {
                    callback(payload)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [table, filter]) // eslint-disable-line react-hooks/exhaustive-deps
}
