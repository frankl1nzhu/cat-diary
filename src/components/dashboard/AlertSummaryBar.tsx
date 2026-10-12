import { useState, useMemo } from 'react'
import type { InventoryItem } from '../../types/database.types'
import type { ExpiryReminderItem } from './ExpiryReminders'
import type { HealthNotifyItem } from './HealthNotifications'
import { ExpiryReminders } from './ExpiryReminders'
import { HealthNotifications } from './HealthNotifications'
import { InventoryAlerts } from './InventoryAlerts'
import { EmptyStateCat } from '../ui/EmptyStateCat'
import { useI18n } from '../../lib/i18n'
import './AlertSummaryBar.css'

export interface AlertSummaryBarProps {
    lowInventory: InventoryItem[]
    expiryReminders: ExpiryReminderItem[]
    healthReminders: HealthNotifyItem[]
    online?: boolean
    discardingExpiryId?: string | null
    onDiscardExpiry?: (id: string) => Promise<void>
    onUsedUpExpiry?: (id: string) => Promise<void>
    onReplenishInventory?: (id: string, totalQuantity: number, alertThreshold: number) => Promise<void>
    renewHealth?: React.ComponentProps<typeof HealthNotifications>['renew']
    onSnooze: (opts: {
        type: 'inventory' | 'expiry' | 'health'
        id: string
        title: string
        currentSnoozedUntil?: string | null
    }) => void
}

export function AlertSummaryBar({
    lowInventory,
    expiryReminders,
    healthReminders,
    online = true,
    discardingExpiryId = null,
    onDiscardExpiry = async () => {},
    onUsedUpExpiry = async () => {},
    onReplenishInventory = async () => {},
    renewHealth,
    onSnooze,
}: AlertSummaryBarProps) {
    const { language } = useI18n()
    const [expanded, setExpanded] = useState(false)

    const inventoryCount = lowInventory.length
    const expiryCount = expiryReminders.length
    const healthCount = healthReminders.length
    const totalCount = inventoryCount + expiryCount + healthCount

    const text = useMemo(() => language === 'zh'
        ? {
            title: '待处理事项',
            itemsPending: (c: number) => `${c} 项待处理`,
            inventoryBadge: (c: number) => `物资 ${c}`,
            expiryBadge: (c: number) => `临期 ${c}`,
            healthBadge: (c: number) => `疫苗健康 ${c}`,
            expand: '展开 ▼',
            collapse: '收起 ▲',
            allResolved: '所有预警已处理完毕',
            allResolvedDesc: '咪子很安心，伸个懒腰~',
            snoozeTitle: (name: string) => `延期提醒 · ${name}`,
        }
        : {
            title: 'Pending Alerts',
            itemsPending: (c: number) => `${c} alerts pending`,
            inventoryBadge: (c: number) => `Supplies ${c}`,
            expiryBadge: (c: number) => `Expiring ${c}`,
            healthBadge: (c: number) => `Health ${c}`,
            expand: 'Expand ▼',
            collapse: 'Collapse ▲',
            allResolved: 'All alerts resolved',
            allResolvedDesc: 'Your cat is relaxed and stretching happily~',
            snoozeTitle: (name: string) => `Snooze alert · ${name}`,
        },
    [language])

    // If zero alerts across all categories, render nothing (height 0)
    if (totalCount === 0) {
        return null
    }

    // How many non-empty alert categories exist
    const activeCategories = (inventoryCount > 0 ? 1 : 0) + (expiryCount > 0 ? 1 : 0) + (healthCount > 0 ? 1 : 0)

    // When only 1 alert category exists, render that component directly without summary bar
    if (activeCategories === 1) {
        if (expiryCount > 0) {
            return (
                <ExpiryReminders
                    items={expiryReminders}
                    online={online}
                    discardingId={discardingExpiryId}
                    onDiscard={onDiscardExpiry}
                    onUsedUp={onUsedUpExpiry}
                    onSnooze={(item) => onSnooze({
                        type: 'expiry',
                        id: item.id,
                        title: text.snoozeTitle(item.item_name),
                        currentSnoozedUntil: item.snoozed_until,
                    })}
                />
            )
        }
        if (healthCount > 0 && renewHealth) {
            return (
                <HealthNotifications
                    items={healthReminders}
                    renew={renewHealth}
                    online={online}
                    onSnooze={(item) => onSnooze({
                        type: 'health',
                        id: item.id,
                        title: text.snoozeTitle(item.name),
                        currentSnoozedUntil: item.snoozed_until,
                    })}
                />
            )
        }
        if (inventoryCount > 0) {
            return (
                <InventoryAlerts
                    items={lowInventory}
                    online={online}
                    onReplenish={onReplenishInventory}
                    onSnooze={(item) => onSnooze({
                        type: 'inventory',
                        id: item.id,
                        title: text.snoozeTitle(item.item_name),
                        currentSnoozedUntil: item.snoozed_until,
                    })}
                />
            )
        }
    }

    // Multiple alert categories exist: render lightweight aggregated bar
    return (
        <div className="alert-summary-container">
            <div
                className="alert-summary-bar"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setExpanded(!expanded)
                    }
                }}
            >
                <div className="alert-summary-left">
                    <span className="alert-summary-icon" aria-hidden="true">⚠️</span>
                    <span className="alert-summary-title">{text.title} · {text.itemsPending(totalCount)}</span>
                    <div className="alert-summary-chips">
                        {expiryCount > 0 && (
                            <span className="alert-summary-chip chip-expiry">{text.expiryBadge(expiryCount)}</span>
                        )}
                        {healthCount > 0 && (
                            <span className="alert-summary-chip chip-health">{text.healthBadge(healthCount)}</span>
                        )}
                        {inventoryCount > 0 && (
                            <span className="alert-summary-chip chip-inventory">{text.inventoryBadge(inventoryCount)}</span>
                        )}
                    </div>
                </div>
                <span className="alert-summary-toggle">
                    {expanded ? text.collapse : text.expand}
                </span>
            </div>

            {expanded && (
                <div className="alert-summary-expanded fade-in">
                    {expiryCount > 0 && (
                        <ExpiryReminders
                            items={expiryReminders}
                            online={online}
                            discardingId={discardingExpiryId}
                            onDiscard={onDiscardExpiry}
                            onUsedUp={onUsedUpExpiry}
                            onSnooze={(item) => onSnooze({
                                type: 'expiry',
                                id: item.id,
                                title: text.snoozeTitle(item.item_name),
                                currentSnoozedUntil: item.snoozed_until,
                            })}
                        />
                    )}

                    {healthCount > 0 && renewHealth && (
                        <HealthNotifications
                            items={healthReminders}
                            renew={renewHealth}
                            online={online}
                            onSnooze={(item) => onSnooze({
                                type: 'health',
                                id: item.id,
                                title: text.snoozeTitle(item.name),
                                currentSnoozedUntil: item.snoozed_until,
                            })}
                        />
                    )}

                    {inventoryCount > 0 && (
                        <InventoryAlerts
                            items={lowInventory}
                            online={online}
                            onReplenish={onReplenishInventory}
                            onSnooze={(item) => onSnooze({
                                type: 'inventory',
                                id: item.id,
                                title: text.snoozeTitle(item.item_name),
                                currentSnoozedUntil: item.snoozed_until,
                            })}
                        />
                    )}

                    {totalCount === 0 && (
                        <EmptyStateCat
                            posture="lazy_stretch"
                            message={text.allResolved}
                            description={text.allResolvedDesc}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
