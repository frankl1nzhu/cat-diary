import { Skeleton } from './Skeleton'

export function DashboardSkeleton() {
    return (
        <div className="dashboard fade-in" aria-busy="true" aria-label="加载首页内容">
            {/* 猫咪资料卡骨架 */}
            <div className="cat-profile-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-4)' }}>
                    <Skeleton width="64px" height="64px" borderRadius="var(--radius-full)" />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <Skeleton width="120px" height="22px" borderRadius="var(--radius-sm)" />
                        <Skeleton width="180px" height="14px" borderRadius="var(--radius-sm)" />
                    </div>
                </div>
            </div>

            {/* 预警/操作 Bento Grid 骨架 */}
            <div className="bento-grid">
                <Skeleton height="110px" borderRadius="var(--radius-lg)" />
                <Skeleton height="110px" borderRadius="var(--radius-lg)" />
                <Skeleton height="110px" borderRadius="var(--radius-lg)" className="span-2" />
            </div>

            {/* 模块卡片骨架 */}
            <div className="px-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Skeleton height="140px" borderRadius="var(--radius-lg)" />
                <Skeleton height="180px" borderRadius="var(--radius-lg)" />
            </div>
        </div>
    )
}
