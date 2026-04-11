import { memo, useState } from 'react'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import type { InventoryItem } from '../../types/database.types'
import { computeInventoryStatus, computeDaysRemaining } from '../../types/database.types'

interface InventoryAlertsProps {
    items: InventoryItem[]
    online: boolean
    onReplenish: (id: string, totalQuantity: number, dailyConsumption: number) => Promise<void>
}

export const InventoryAlerts = memo(function InventoryAlerts({ items, online, onReplenish }: InventoryAlertsProps) {
    const [replenishModalOpen, setReplenishModalOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [newTotalQty, setNewTotalQty] = useState('')
    const [newDailyCons, setNewDailyCons] = useState('')
    const [saving, setSaving] = useState(false)

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
                        🛒 库存预警
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
                                                ? `约剩 ${Math.max(0, Math.round(days))} 天`
                                                : status === 'urgent' ? '紧急' : '偏低'}
                                        </span>
                                    </div>
                                    <span
                                        className={`inventory-alert-status ${isUrgent ? 'text-danger' : 'text-warning'}`}
                                    >
                                        {isUrgent ? '🔴 紧急' : '🟡 偏低'}
                                    </span>
                                    <button
                                        type="button"
                                        className="inventory-replenish-btn"
                                        onClick={() => openReplenishModal(item)}
                                        disabled={!online}
                                    >
                                        补充
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
                title={`🛒 补充 ${selectedItem?.item_name || '物资'}`}
            >
                <div className="replenish-form">
                    <div className="form-section">
                        <label className="form-label" htmlFor="replenish-total-qty">
                            总量
                        </label>
                        <input
                            id="replenish-total-qty"
                            className="form-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            placeholder="例：28（袋/罐等）"
                            value={newTotalQty}
                            onChange={(e) => setNewTotalQty(e.target.value)}
                        />
                        <span className="text-xs text-muted">重新设定当前库存总量</span>
                    </div>
                    <div className="form-section">
                        <label className="form-label" htmlFor="replenish-daily-cons">
                            每日消耗
                        </label>
                        <input
                            id="replenish-daily-cons"
                            className="form-input"
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.1"
                            placeholder="例：1"
                            value={newDailyCons}
                            onChange={(e) => setNewDailyCons(e.target.value)}
                        />
                        <span className="text-xs text-muted">每日使用量，用于计算剩余天数</span>
                    </div>

                    {newTotalQty && newDailyCons && parseFloat(newDailyCons) > 0 && (
                        <div className="replenish-preview">
                            <span className="text-sm">
                                预计可用 <strong>{Math.round(parseFloat(newTotalQty) / parseFloat(newDailyCons))}</strong> 天
                            </span>
                        </div>
                    )}

                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleReplenish}
                        disabled={saving || !online || !newTotalQty || !newDailyCons}
                    >
                        {saving ? '更新中...' : '确认补充'}
                    </Button>
                </div>
            </Modal>
        </>
    )
})
