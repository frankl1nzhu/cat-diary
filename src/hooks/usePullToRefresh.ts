import { useState, useRef, useCallback, useEffect } from 'react'

interface UsePullToRefreshOptions {
    onRefresh: () => Promise<void>
    /** Minimum pull distance to trigger, default 80 */
    threshold?: number
    /** Whether pull-to-refresh is enabled, default true */
    enabled?: boolean
}

export function usePullToRefresh({
    onRefresh,
    threshold = 80,
    enabled = true,
}: UsePullToRefreshOptions) {
    const [pullDistance, setPullDistance] = useState(0)
    const [refreshing, setRefreshing] = useState(false)
    const startYRef = useRef<number | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const isReady = pullDistance >= threshold

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        if (!enabled || refreshing) return
        const el = containerRef.current
        // Only enable pull if scrolled to top
        if (el && el.scrollTop > 0) return
        startYRef.current = e.touches[0].clientY
    }, [enabled, refreshing])

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (startYRef.current === null || refreshing) return
        const delta = e.touches[0].clientY - startYRef.current
        if (delta > 0) {
            // Apply resistance curve
            const distance = Math.min(delta * 0.5, 150)
            setPullDistance(distance)
        }
    }, [refreshing])

    const onTouchEnd = useCallback(async () => {
        if (startYRef.current === null) return
        startYRef.current = null

        if (pullDistance >= threshold && !refreshing) {
            setRefreshing(true)
            setPullDistance(threshold * 0.5) // Snap to loading position
            try {
                await onRefresh()
            } finally {
                setRefreshing(false)
                setPullDistance(0)
            }
        } else {
            setPullDistance(0)
        }
    }, [pullDistance, threshold, refreshing, onRefresh])

    // Reset on unmount
    useEffect(() => {
        return () => {
            startYRef.current = null
            setPullDistance(0)
        }
    }, [])

    return {
        containerRef,
        pullDistance,
        refreshing,
        isReady,
        handlers: {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
        },
    }
}
