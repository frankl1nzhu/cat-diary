interface SkeletonProps {
    width?: string
    height?: string
    borderRadius?: string
    className?: string
}

export function Skeleton({
    width = '100%',
    height = '20px',
    borderRadius,
    className = '',
}: SkeletonProps) {
    return (
        <div
            className={`skeleton ${className}`}
            role="status"
            aria-label="加载中"
            style={{
                width,
                height,
                borderRadius: borderRadius || 'var(--radius-sm)',
            }}
        />
    )
}
