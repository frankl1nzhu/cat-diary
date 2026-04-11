import { memo } from 'react'
import { Card } from '../ui/Card'
import type { InventoryExpiryReminder } from '../../types/database.types'
import { format } from 'date-fns'

export type ExpiryReminderItem = InventoryExpiryReminder & { hoursLeft: number }

interface ExpiryRemindersProps {
    items: ExpiryReminderItem[]
    online: boolean
    discardingId: string | null
    onDiscard: (id: string) => Promise<void>
    onUsedUp: (id: string) => Promise<void>
}

export const ExpiryReminders = memo(function ExpiryReminders({ items, online, discardingId, onDiscard, onUsedUp }: ExpiryRemindersProps) {
    if (items.length === 0) return null

    return (
        <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
            <Card variant="default" padding="md">
                <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                    📦 物品过期提醒
                </h2>
                <div className="expired-reminder-list">
                    {items.map((item) => {
                        const isExpired = item.hoursLeft < 0
                        const expiredHours = Math.abs(item.hoursLeft)
                        return (
                            <div
                                key={item.id}
                                className={`expired-reminder-item ${isExpired ? 'expired-reminder-overdue' : 'expired-reminder-active'}`}
                            >
                                <div className="expired-reminder-info">
                                    <span className="text-sm font-semibold">{item.item_name}</span>
                                    <span className="text-xs text-muted">
                                        {isExpired
                                            ? `已过期 ${expiredHours} 小时`
                                            : `将于 ${format(new Date(item.expires_at), 'MM/dd HH:mm')} 过期（剩余 ${item.hoursLeft} 小时）`
                                        }
                                    </span>
                                </div>
                                {isExpired ? (
                                    <button
                                        type="button"
                                        className="expired-reminder-btn"
                                        disabled={!online || discardingId === item.id}
                                        onClick={() => { void onDiscard(item.id) }}
                                    >
                                        {discardingId === item.id ? '处理中...' : '已丢弃'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="expired-reminder-btn expired-usedup-btn"
                                        disabled={!online || discardingId === item.id}
                                        onClick={() => { void onUsedUp(item.id) }}
                                    >
                                        {discardingId === item.id ? '处理中...' : '已用完'}
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </Card>
        </div>
    )
})
