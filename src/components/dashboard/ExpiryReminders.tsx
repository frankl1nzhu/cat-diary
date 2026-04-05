import { memo } from 'react'
import { Card } from '../ui/Card'
import type { InventoryExpiryReminder } from '../../types/database.types'

export type OverdueExpiryReminderItem = InventoryExpiryReminder & { daysLeft: number }

interface ExpiryRemindersProps {
    items: OverdueExpiryReminderItem[]
    online: boolean
    discardingId: string | null
    onDiscard: (id: string) => Promise<void>
}

export const ExpiryReminders = memo(function ExpiryReminders({ items, online, discardingId, onDiscard }: ExpiryRemindersProps) {
    if (items.length === 0) return null

    return (
        <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
            <Card variant="default" padding="md">
                <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                    🗑️ 过期物品提醒
                </h2>
                <div className="expired-reminder-list">
                    {items.map((item) => {
                        const expiredDays = Math.abs(item.daysLeft)
                        return (
                            <div key={item.id} className="expired-reminder-item">
                                <div className="expired-reminder-info">
                                    <span className="text-sm font-semibold">{item.item_name}</span>
                                    <span className="text-xs text-muted">已过期 {expiredDays} 天</span>
                                </div>
                                <button
                                    type="button"
                                    className="expired-reminder-btn"
                                    disabled={!online || discardingId === item.id}
                                    onClick={() => { void onDiscard(item.id) }}
                                >
                                    {discardingId === item.id ? '处理中...' : '已丢弃'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </Card>
        </div>
    )
})
