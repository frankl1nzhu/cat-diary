import type { CSSProperties } from 'react'

interface SkeletonProps {
    width?: string
    height?: string
    borderRadius?: string
    className?: string
    style?: CSSProperties
}

export function Skeleton({
    width = '100%',
    height = '20px',
    borderRadius,
    className = '',
    style,
}: SkeletonProps) {
    return (
        <div
            className={`skeleton skeleton-shimmer ${className}`}
            role="status"
            aria-label="加载中"
            style={{
                width,
                height,
                borderRadius: borderRadius || 'var(--radius-sm)',
                ...style,
            }}
        />
    )
}
