import { memo, useState } from 'react'
import { Card } from '../ui/Card'
import type { InventoryExpiryReminder } from '../../types/database.types'
import { format } from 'date-fns'
import { useI18n } from '../../lib/i18n'

export type ExpiryReminderItem = InventoryExpiryReminder & { hoursLeft: number }

interface ExpiryRemindersProps {
    items: ExpiryReminderItem[]
    online: boolean
    discardingId: string | null
    onDiscard: (id: string) => Promise<void>
    onUsedUp: (id: string) => Promise<void>
}

export const ExpiryReminders = memo(function ExpiryReminders({ items, online, discardingId, onDiscard, onUsedUp }: ExpiryRemindersProps) {
    const { language } = useI18n()
    const [pendingUsedUpId, setPendingUsedUpId] = useState<string | null>(null)
    const text = language === 'zh'
        ? {
            title: '📦 物品过期提醒',
            expiredHours: (hours: number) => `已过期 ${hours} 小时`,
            willExpire: (dateText: string, hoursLeft: number) => `将于 ${dateText} 过期（剩余 ${hoursLeft} 小时）`,
            processing: '处理中...',
            discarded: '已丢弃',
            usedUp: '已用完',
            confirmUsedUp: '确认已用完？',
            confirm: '确认',
            cancel: '取消',
        }
        : {
            title: '📦 Expiry Alerts',
            expiredHours: (hours: number) => `Expired ${hours} hours ago`,
            willExpire: (dateText: string, hoursLeft: number) => `Expires at ${dateText} (${hoursLeft} hours left)`,
            processing: 'Processing...',
            discarded: 'Discarded',
            usedUp: 'Used up',
            confirmUsedUp: 'Confirm used up?',
            confirm: 'Confirm',
            cancel: 'Cancel',
        }

    if (items.length === 0) return null

    return (
        <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
            <Card variant="default" padding="md">
                <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                    {text.title}
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
                                            ? text.expiredHours(expiredHours)
                                            : text.willExpire(format(new Date(item.expires_at), 'MM/dd HH:mm'), item.hoursLeft)
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
                                        {discardingId === item.id ? text.processing : text.discarded}
                                    </button>
                                ) : pendingUsedUpId === item.id ? (
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                        <span className="text-xs text-secondary" style={{ whiteSpace: 'nowrap' }}>{text.confirmUsedUp}</span>
                                        <button
                                            type="button"
                                            className="expired-reminder-btn expired-usedup-btn"
                                            disabled={!online || discardingId === item.id}
                                            onClick={() => { setPendingUsedUpId(null); void onUsedUp(item.id) }}
                                        >
                                            {discardingId === item.id ? text.processing : text.confirm}
                                        </button>
                                        <button
                                            type="button"
                                            className="expired-reminder-btn"
                                            style={{ background: 'var(--glass-bg)' }}
                                            onClick={() => setPendingUsedUpId(null)}
                                        >
                                            {text.cancel}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        className="expired-reminder-btn expired-usedup-btn"
                                        disabled={!online || discardingId === item.id}
                                        onClick={() => setPendingUsedUpId(item.id)}
                                    >
                                        {text.usedUp}
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
