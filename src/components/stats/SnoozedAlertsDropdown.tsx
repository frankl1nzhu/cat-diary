import { memo, useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '../ui/Card'
import { supabase } from '../../lib/supabase'
import { useI18n } from '../../lib/i18n'
import { useToastStore } from '../../stores/useToastStore'
import { getErrorMessage } from '../../lib/errorMessage'
import { isItemActivelySnoozed } from '../../types/database.types'
import { format, differenceInCalendarDays, parseISO } from 'date-fns'

export interface SnoozedItem {
    id: string
    type: 'inventory' | 'expiry' | 'health'
    name: string
    icon?: string
    snoozedUntil: string
    daysLeft: number
}

interface SnoozedAlertsDropdownListProps {
    items: SnoozedItem[]
    onUnsnooze: (item: SnoozedItem) => Promise<void> | void
    online: boolean
    unsnoozingId?: string | null
    defaultExpanded?: boolean
}

export const SnoozedAlertsDropdownList = memo(function SnoozedAlertsDropdownList({
    items,
    onUnsnooze,
    online,
    unsnoozingId,
    defaultExpanded = false,
}: SnoozedAlertsDropdownListProps) {
    const { language } = useI18n()
    const [expanded, setExpanded] = useState(defaultExpanded)

    const text = useMemo(() => language === 'zh'
        ? {
            title: (count: number) => `⏰ 已延期提醒 (${count})`,
            collapse: '收起 ▲',
            expand: '展开 ▼',
            restore: '提前恢复',
            restoring: '恢复中...',
            daysLeft: (days: number) => `剩余 ${days} 天`,
            untilDate: (d: string) => `延期至 ${d}`,
        }
        : {
            title: (count: number) => `⏰ Snoozed Alerts (${count})`,
            collapse: 'Collapse ▲',
            expand: 'Expand ▼',
            restore: 'Restore',
            restoring: 'Restoring...',
            daysLeft: (days: number) => `${days} days left`,
            untilDate: (d: string) => `Until ${d}`,
        }, [language])

    if (items.length === 0) return null

    return (
        <div className="snoozed-dropdown-section" style={{ marginBottom: 'var(--space-3)' }}>
            <Card variant="default" padding="sm">
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        padding: 'var(--space-1) var(--space-2)',
                    }}
                    onClick={() => setExpanded(!expanded)}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span className="font-semibold text-sm">{text.title(items.length)}</span>
                    </div>
                    <span className="text-xs text-secondary">{expanded ? text.collapse : text.expand}</span>
                </div>

                {expanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)' }}>
                        {items.map((item) => {
                            const isProcessing = unsnoozingId === item.id
                            const dateLabel = format(new Date(item.snoozedUntil), 'MM/dd')
                            return (
                                <div
                                    key={`${item.type}-${item.id}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 'var(--space-2)',
                                        background: 'var(--color-bg-input)',
                                        borderRadius: 'var(--radius-md)',
                                        gap: 'var(--space-2)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                                        <span>{item.icon || (item.type === 'inventory' ? '🛒' : item.type === 'expiry' ? '📦' : '🩺')}</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                            <span className="text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.name}
                                            </span>
                                            <span className="text-xs text-secondary">
                                                {text.untilDate(dateLabel)} · {text.daysLeft(item.daysLeft)}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="inventory-replenish-btn"
                                        style={{ whiteSpace: 'nowrap', padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }}
                                        disabled={!online || isProcessing}
                                        onClick={() => onUnsnooze(item)}
                                    >
                                        {isProcessing ? text.restoring : text.restore}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Card>
        </div>
    )
})

interface SnoozedAlertsDropdownProps {
    catId: string | null
    online: boolean
    onUnsnoozeSuccess?: () => void
}

export function SnoozedAlertsDropdown({ catId, online, onUnsnoozeSuccess }: SnoozedAlertsDropdownProps) {
    const { language } = useI18n()
    const pushToast = useToastStore((s) => s.pushToast)
    const [items, setItems] = useState<SnoozedItem[]>([])
    const [unsnoozingId, setUnsnoozingId] = useState<string | null>(null)

    const loadSnoozedItems = useCallback(async () => {
        if (!catId) {
            setItems([])
            return
        }
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        const todayDate = parseISO(todayStr)

        try {
            const [invRes, expRes, healthRes] = await Promise.all([
                supabase
                    .from('inventory')
                    .select('id,item_name,icon,snoozed_until')
                    .eq('cat_id', catId)
                    .not('snoozed_until', 'is', null),
                supabase
                    .from('inventory_expiry_reminders')
                    .select('id,item_name,snoozed_until')
                    .eq('cat_id', catId)
                    .is('discarded_at', null)
                    .not('snoozed_until', 'is', null),
                supabase
                    .from('health_records')
                    .select('id,name,type,snoozed_until')
                    .eq('cat_id', catId)
                    .not('snoozed_until', 'is', null),
            ])

            const list: SnoozedItem[] = []

            if (invRes.data) {
                invRes.data.forEach((i) => {
                    if (isItemActivelySnoozed(i.snoozed_until, todayStr)) {
                        const daysLeft = differenceInCalendarDays(new Date(i.snoozed_until!), todayDate)
                        list.push({
                            id: i.id,
                            type: 'inventory',
                            name: i.item_name,
                            icon: i.icon || '🛒',
                            snoozedUntil: i.snoozed_until!,
                            daysLeft,
                        })
                    }
                })
            }

            if (expRes.data) {
                expRes.data.forEach((e) => {
                    if (isItemActivelySnoozed(e.snoozed_until, todayStr)) {
                        const daysLeft = differenceInCalendarDays(new Date(e.snoozed_until!), todayDate)
                        list.push({
                            id: e.id,
                            type: 'expiry',
                            name: e.item_name,
                            icon: '📦',
                            snoozedUntil: e.snoozed_until!,
                            daysLeft,
                        })
                    }
                })
            }

            if (healthRes.data) {
                healthRes.data.forEach((h) => {
                    if (isItemActivelySnoozed(h.snoozed_until, todayStr)) {
                        const daysLeft = differenceInCalendarDays(new Date(h.snoozed_until!), todayDate)
                        list.push({
                            id: h.id,
                            type: 'health',
                            name: h.name,
                            icon: h.type === 'vaccine' ? '💉' : '💊',
                            snoozedUntil: h.snoozed_until!,
                            daysLeft,
                        })
                    }
                })
            }

            list.sort((a, b) => a.daysLeft - b.daysLeft)
            setItems(list)
        } catch (err) {
            console.error('Failed to load snoozed alerts:', err)
        }
    }, [catId])

    useEffect(() => {
        loadSnoozedItems()
    }, [loadSnoozedItems])

    const handleUnsnooze = async (item: SnoozedItem) => {
        if (!online || unsnoozingId) return
        setUnsnoozingId(item.id)
        try {
            const table = item.type === 'inventory' ? 'inventory' : item.type === 'expiry' ? 'inventory_expiry_reminders' : 'health_records'
            const { error } = await supabase
                .from(table)
                .update({ snoozed_until: null } as any)
                .eq('id', item.id)

            if (error) throw error
            pushToast('success', language === 'zh' ? '已提前恢复提醒，将在主页展示 ✅' : 'Alert restored to homepage ✅')
            await loadSnoozedItems()
            onUnsnoozeSuccess?.()
        } catch (err) {
            pushToast('error', getErrorMessage(err, language === 'zh' ? '恢复失败，请重试' : 'Failed to restore alert'))
        } finally {
            setUnsnoozingId(null)
        }
    }

    return (
        <SnoozedAlertsDropdownList
            items={items}
            onUnsnooze={handleUnsnooze}
            online={online}
            unsnoozingId={unsnoozingId}
        />
    )
}
