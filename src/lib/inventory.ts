import type { InventoryItem, InventoryStatus } from '../types/database.types'

/** Compute days remaining from total_quantity / daily_consumption. */
export function computeDaysRemaining(item: InventoryItem): number | null {
    if (item.total_quantity == null || item.daily_consumption == null || item.daily_consumption <= 0) return null
    return item.total_quantity / item.daily_consumption
}

/** Derive status from days remaining: <7 = urgent, <14 = low, else plenty. */
export function computeInventoryStatus(item: InventoryItem): InventoryStatus {
    const days = computeDaysRemaining(item)
    if (days == null) return item.status // fallback to stored status
    if (days < 7) return 'urgent'
    if (days < 14) return 'low'
    return 'plenty'
}
