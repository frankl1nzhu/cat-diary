/* ─── Offline Operation Queue ──────────────────────
 *  Stores failed Supabase mutations in IndexedDB and
 *  replays them when connectivity is restored.
 * ─────────────────────────────────────────────────── */

const DB_NAME = 'cat-diary-offline'
const STORE_NAME = 'pending-ops'
const DB_VERSION = 1

/** Allowed tables for offline queue replay to prevent IndexedDB tampering. */
const ALLOWED_TABLES = new Set([
    'diary_entries', 'mood_logs', 'poop_logs', 'weight_records',
    'health_records', 'feed_status', 'inventory',
])

export interface OfflineOp {
    id: string
    table: string
    type: 'insert' | 'update' | 'delete'
    payload: Record<string, unknown>
    /** ISO timestamp of when the op was queued */
    createdAt: string
}

/** Cached DB connection singleton. */
let _dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
    if (_dbPromise) return _dbPromise
    _dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
            const db = request.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
            }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => {
            _dbPromise = null
            reject(request.error)
        }
    })
    return _dbPromise
}

/** Enqueue an operation for later sync. */
export async function enqueueOp(op: Omit<OfflineOp, 'id' | 'createdAt'>): Promise<void> {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const entry: OfflineOp = {
        ...op,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
    }
    store.add(entry)
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

/** Retrieve all pending operations (oldest first). */
export async function getPendingOps(): Promise<OfflineOp[]> {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            const ops = (request.result as OfflineOp[]).sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            )
            resolve(ops)
        }
        request.onerror = () => reject(request.error)
    })
}

/** Remove a successfully synced operation. */
export async function removeOp(id: string): Promise<void> {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

/** Flush (replay) all pending operations against Supabase. */
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
    const { supabase } = await import('./supabase')
    const ops = await getPendingOps()
    let synced = 0
    let failed = 0

    for (const op of ops) {
        try {
            if (!ALLOWED_TABLES.has(op.table)) {
                console.warn(`[OfflineQueue] Skipping disallowed table: ${op.table}`)
                await removeOp(op.id)
                continue
            }
            if (op.type === 'insert') {
                // Dynamic table name — use type assertion narrowed by ALLOWED_TABLES check above
                const { error } = await supabase.from(op.table as 'diary_entries').insert(op.payload as never)
                if (error) throw error
            } else if (op.type === 'update') {
                const { id: rowId, ...rest } = op.payload as { id: string;[k: string]: unknown }
                if (!rowId) throw new Error('Missing row id for update')
                const { error } = await supabase.from(op.table as 'diary_entries').update(rest as never).eq('id', rowId)
                if (error) throw error
            } else if (op.type === 'delete') {
                const rowId = op.payload.id as string | undefined
                if (!rowId) throw new Error('Missing row id for delete')
                const { error } = await supabase.from(op.table).delete().eq('id', rowId)
                if (error) throw error
            }
            await removeOp(op.id)
            synced++
        } catch (err) {
            console.warn(`[OfflineQueue] Failed to replay op ${op.id}:`, err)
            failed++
        }
    }

    return { synced, failed }
}

/** Automatically flush the queue when the browser comes back online. */
export function startOfflineSync(): () => void {
    const handler = () => {
        flushQueue().then(({ synced }) => {
            if (synced > 0) {
                console.info(`[OfflineQueue] Synced ${synced} pending operations`)
            }
        }).catch(() => { /* swallow — will retry on next online event */ })
    }

    window.addEventListener('online', handler)

    // Also flush immediately if already online
    if (navigator.onLine) {
        handler()
    }

    return () => window.removeEventListener('online', handler)
}
