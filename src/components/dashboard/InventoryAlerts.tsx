import { memo, useState } from 'react'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { InventoryItem } from '../../types/database.types'
import { computeInventoryStatus, computeDaysRemaining } from '../../types/database.types'
import { useI18n } from '../../lib/i18n'

interface InventoryAlertsProps {
    items: InventoryItem[]
    online: boolean
    onReplenish: (id: string, totalQuantity: number, dailyConsumption: number) => Promise<void>
}

export const InventoryAlerts = memo(function InventoryAlerts({ items, online, onReplenish }: InventoryAlertsProps) {
    const { language } = useI18n()
    const [replenishModalOpen, setReplenishModalOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [newTotalQty, setNewTotalQty] = useState('')
    const [newDailyCons, setNewDailyCons] = useState('')
    const [saving, setSaving] = useState(false)
    const text = language === 'zh'
        ? {
            title: '🛒 库存预警',
            daysLeft: (days: number) => `约剩 ${days} 天`,
            urgent: '紧急',
            low: '偏低',
            urgentBadge: '🔴 紧急',
            lowBadge: '🟡 偏低',
            replenish: '补充',
            replenishTitle: (name: string) => `🛒 补充 ${name}`,
            defaultItem: '物资',
            totalQty: '总量',
            totalQtyPlaceholder: '例：28（袋/罐等）',
            totalQtyHint: '重新设定当前库存总量',
            dailyCons: '每日消耗',
            dailyConsPlaceholder: '例：1',
            dailyConsHint: '每日使用量，用于计算剩余天数',
            availableDays: (days: number) => `预计可用 ${days} 天`,
            updating: '更新中...',
            confirm: '确认补充',
        }
        : {
            title: '🛒 Inventory Alerts',
            daysLeft: (days: number) => `${days} days left`,
            urgent: 'Urgent',
            low: 'Low',
            urgentBadge: '🔴 Urgent',
            lowBadge: '🟡 Low',
            replenish: 'Refill',
            replenishTitle: (name: string) => `🛒 Refill ${name}`,
            defaultItem: 'item',
            totalQty: 'Total quantity',
            totalQtyPlaceholder: 'e.g. 28 (bags/cans)',
            totalQtyHint: 'Reset current total inventory',
            dailyCons: 'Daily consumption',
            dailyConsPlaceholder: 'e.g. 1',
            dailyConsHint: 'Used to calculate remaining days',
            availableDays: (days: number) => `Estimated ${days} days available`,
            updating: 'Updating...',
            confirm: 'Confirm refill',
        }

    if (items.length === 0) return null

    const openReplenishModal = (item: InventoryItem) => {
        setSelectedItem(item)
        setNewTotalQty(item.total_quantity != null ? String(item.total_quantity) : '')
        setNewDailyCons(item.daily_consumption != null ? String(item.daily_consumption) : '')
        setReplenishModalOpen(true)
    }

    const handleReplenish = async () => {
        if (!selectedItem || saving) return
        const totalQty = newTotalQty ? parseFloat(newTotalQty) : null
        const dailyCons = newDailyCons ? parseFloat(newDailyCons) : null
        if (totalQty == null || totalQty < 0) return
        if (dailyCons == null || dailyCons <= 0) return

        setSaving(true)
        try {
            await onReplenish(selectedItem.id, totalQty, dailyCons)
            setReplenishModalOpen(false)
            setSelectedItem(null)
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="px-4 stagger-item inventory-alert-card">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                        {text.title}
                    </h2>
                    <div className="inventory-alert-list">
                        {items.map((item) => {
                            const status = computeInventoryStatus(item)
                            const days = computeDaysRemaining(item)
                            const isUrgent = status === 'urgent'
                            const icon = item.icon || '📦'
                            return (
                                <div
                                    key={item.id}
                                    className={`inventory-alert-item ${isUrgent ? 'inventory-alert-urgent' : 'inventory-alert-low'}`}
                                >
                                    <span className="inventory-alert-icon">{icon}</span>
                                    <div className="inventory-alert-info">
                                        <span className="text-sm font-semibold">{item.item_name}</span>
                                        <span className="text-xs text-muted">
                                            {days != null
                                                ? text.daysLeft(Math.max(0, Math.round(days)))
                                                : status === 'urgent' ? text.urgent : text.low}
                                        </span>
                                    </div>
                                    <span
                                        className={`inventory-alert-status ${isUrgent ? 'text-danger' : 'text-warning'}`}
                                    >
                                        {isUrgent ? text.urgentBadge : text.lowBadge}
                                    </span>
                                    <button
                                        type="button"
                                        className="inventory-replenish-btn"
                                        onClick={() => openReplenishModal(item)}
                                        disabled={!online}
                                    >
                                        {text.replenish}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>

            <Modal
                isOpen={replenishModalOpen}
                onClose={() => setReplenishModalOpen(false)}
                title={text.replenishTitle(selectedItem?.item_name || text.defaultItem)}
            >
                <div className="replenish-form">
                    <div className="form-section">
                        <label className="form-label" htmlFor="replenish-total-qty">
                            {text.totalQty}
                        </label>
                        <input
                            id="replenish-total-qty"
                            className="form-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            placeholder={text.totalQtyPlaceholder}
                            value={newTotalQty}
                            onChange={(e) => setNewTotalQty(e.target.value)}
                        />
                        <span className="text-xs text-muted">{text.totalQtyHint}</span>
                    </div>
                    <div className="form-section">
                        <label className="form-label" htmlFor="replenish-daily-cons">
                            {text.dailyCons}
                        </label>
                        <input
                            id="replenish-daily-cons"
                            className="form-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            placeholder={text.dailyConsPlaceholder}
                            value={newDailyCons}
                            onChange={(e) => setNewDailyCons(e.target.value)}
                        />
                        <span className="text-xs text-muted">{text.dailyConsHint}</span>
                    </div>

                    {newTotalQty && newDailyCons && parseFloat(newDailyCons) > 0 && (
                        <div className="replenish-preview">
                            <span className="text-sm">
                                {text.availableDays(Math.round(parseFloat(newTotalQty) / parseFloat(newDailyCons)))}
                            </span>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleReplenish}
                        disabled={saving || !online || !newTotalQty || !newDailyCons}
                    >
                        {saving ? text.updating : text.confirm}
                    </Button>
                </div>
            </Modal>
        </>
    )
})
