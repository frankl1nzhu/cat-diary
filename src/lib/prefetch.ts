/* ─── Route Prefetch ──────────────────────────────
 *  Eagerly load route chunks on pointer/focus to
 *  eliminate navigation delay from lazy() imports.
 * ──────────────────────────────────────────────── */

const routeImports: Record<string, () => Promise<unknown>> = {
    '/': () => import('../pages/DashboardPage'),
    '/log': () => import('../pages/LogPage'),
    '/stats': () => import('../pages/StatsPage'),
    '/settings': () => import('../pages/SettingsPage'),
    '/login': () => import('../pages/LoginPage'),
}

const prefetched = new Set<string>()

/** Trigger the lazy import for a route so the chunk downloads early. */
export function prefetchRoute(path: string) {
    const cleanPath = path.split('?')[0]
    if (prefetched.has(cleanPath)) return
    const loader = routeImports[cleanPath]
    if (loader) {
        prefetched.add(cleanPath)
        loader().catch(() => {
            prefetched.delete(cleanPath)
        })
    }
}

/** onPointerEnter / onFocus handler for nav links. */
export function handlePrefetch(path: string) {
    return () => prefetchRoute(path)
}
