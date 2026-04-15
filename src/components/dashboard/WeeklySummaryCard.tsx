import { memo } from 'react'
import { Card } from '../ui/Card'
import { useI18n } from '../../lib/i18n'

interface WeeklySummaryCardProps {
    weekFeedCount: number
    weekMoodCounts: Record<string, number>
    weekAbnormalPoopCount: number
    weekWeightDelta: number | null
}

export const WeeklySummaryCard = memo(function WeeklySummaryCard({
    weekFeedCount,
    weekMoodCounts,
    weekAbnormalPoopCount,
    weekWeightDelta,
}: WeeklySummaryCardProps) {
    const { language } = useI18n()
    const text = language === 'zh'
        ? {
            title: '📊 本周总结',
            feedCount: '喂食次数',
            moodSplit: '心情分布',
            abnormalPoop: '异常便便',
            weightDelta: '体重变化',
            times: '次',
            noData: '暂无数据',
        }
        : {
            title: '📊 Weekly Summary',
            feedCount: 'Feeding count',
            moodSplit: 'Mood split',
            abnormalPoop: 'Abnormal poop',
            weightDelta: 'Weight change',
            times: 'times',
            noData: 'No data',
        }

    return (
        <div className="px-4 stagger-item">
            <Card variant="default" padding="md">
                <div className="section-row">
                    <h2 className="text-lg font-semibold">{text.title}</h2>
                </div>
                <div className="week-summary-grid">
                    <div className="week-item">
                        <span className="text-sm text-secondary">{text.feedCount}</span>
                        <strong>{weekFeedCount} {text.times}</strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">{text.moodSplit}</span>
                        <strong>😸{weekMoodCounts['😸']} / 😾{weekMoodCounts['😾']} / 😴{weekMoodCounts['😴']}</strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">{text.abnormalPoop}</span>
                        <strong className={weekAbnormalPoopCount > 0 ? 'text-danger' : ''}>
                            {weekAbnormalPoopCount} {text.times}
                        </strong>
                    </div>
                    <div className="week-item">
                        <span className="text-sm text-secondary">{text.weightDelta}</span>
                        <strong>
                            {weekWeightDelta === null
                                ? text.noData
                                : `${weekWeightDelta > 0 ? '+' : ''}${weekWeightDelta} kg`}
                        </strong>
                    </div>
                </div>
            </Card>
        </div>
    )
})
