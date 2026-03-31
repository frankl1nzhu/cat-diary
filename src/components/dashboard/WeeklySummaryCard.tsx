import { Card } from '../ui/Card'

interface WeeklySummaryCardProps {
    weekFeedCount: number
    weekMoodCounts: Record<string, number>
    weekAbnormalPoopCount: number
    weekWeightDelta: number | null
}

export function WeeklySummaryCard({
    weekFeedCount,
    weekMoodCounts,
    weekAbnormalPoopCount,
    weekWeightDelta,
}: WeeklySummaryCardProps) {
    return (
        <div className="px-4 stagger-item">
            <Card variant="default" padding="md">
                <div className="section-row">
                    <h2 className="text-lg font-semibold">📊 本周总结</h2>
                </div>
                <div className="week-summary-grid">
                    <div className="week-item">
                        <span className="text-sm text-secondary">喂食次数</span>
                        <strong>{weekFeedCount} 次</strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">心情分布</span>
                        <strong>😸{weekMoodCounts['😸']} / 😾{weekMoodCounts['😾']} / 😴{weekMoodCounts['😴']}</strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">异常便便</span>
                        <strong className={weekAbnormalPoopCount > 0 ? 'text-danger' : ''}>
                            {weekAbnormalPoopCount} 次
                        </strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">体重变化</span>
                        <strong>
                            {weekWeightDelta === null
                                ? '暂无数据'
                                : `${weekWeightDelta > 0 ? '+' : ''}${weekWeightDelta} kg`}
                        </strong>
                    </div>
                </div>
            </Card>
        </div>
    )
}
