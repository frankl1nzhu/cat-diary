import { Card } from './Card'
import { Skeleton } from './Skeleton'

interface TimelineSkeletonProps {
    count?: number
}

export function TimelineSkeleton({ count = 4 }: TimelineSkeletonProps) {
    return (
        <div className="timeline-list" aria-busy="true" aria-label="加载时间线动态">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i} variant="default" padding="md" className="timeline-card">
                    <Skeleton width="36px" height="36px" borderRadius="var(--radius-full)" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <Skeleton width="60%" height="14px" />
                        <Skeleton width="90%" height="14px" />
                        <Skeleton width="40%" height="12px" />
                    </div>
                </Card>
            ))}
        </div>
    )
}
