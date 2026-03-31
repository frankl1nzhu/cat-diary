/* ─── Route Prefetch ──────────────────────────────
 *  Eagerly load route chunks on pointer/focus to
 *  eliminate navigation delay from lazy() imports.
 *  Also prefetches all routes during browser idle.
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

/**
 * Prefetch all route chunks during browser idle time.
 * Call once after the app has mounted to eliminate
 * navigation delays on first visit to any page.
 */
export function prefetchAllRoutesOnIdle() {
    const allPaths = Object.keys(routeImports)

    const prefetchNext = (paths: string[]) => {
        if (paths.length === 0) return
        const [current, ...rest] = paths
        prefetchRoute(current)
        if (rest.length > 0) {
            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(() => prefetchNext(rest), { timeout: 3000 })
            } else {
                setTimeout(() => prefetchNext(rest), 200)
            }
        }
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => prefetchNext(allPaths), { timeout: 5000 })
    } else {
        setTimeout(() => prefetchNext(allPaths), 2000)
    }
}
