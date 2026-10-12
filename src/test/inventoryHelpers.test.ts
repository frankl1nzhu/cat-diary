import { describe, expect, it } from 'vitest'
import { computeInventoryStatus, roundQuantity, type InventoryItem } from '../types/database.types'

describe('inventoryHelpers', () => {
    describe('roundQuantity', () => {
        it('rounds floating point subtractions cleanly to 1 decimal place by default', () => {
            expect(roundQuantity(500.2 - 0.1)).toBe(500.1)
            expect(roundQuantity(100 - 33.33)).toBe(66.7)
            expect(roundQuantity(50.000000000001)).toBe(50)
            expect(roundQuantity(12.34, 2)).toBe(12.34)
        })
    })

    describe('computeInventoryStatus', () => {
        const baseItem: InventoryItem = {
            id: '1',
            cat_id: 'cat-1',
            item_name: '猫粮',
            status: 'plenty',
            updated_by: null,
            updated_at: new Date().toISOString(),
        }

        it('returns urgent when total_quantity <= 0 even if alert threshold is unset', () => {
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 0, daily_consumption: null })).toBe('urgent')
            expect(computeInventoryStatus({ ...baseItem, total_quantity: -5, daily_consumption: null })).toBe('urgent')
        })

        it('returns urgent when total_quantity <= daily_consumption', () => {
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 100, daily_consumption: 100 })).toBe('urgent')
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 50, daily_consumption: 100 })).toBe('urgent')
        })

        it('returns low when total_quantity is between threshold and 1.5x threshold', () => {
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 120, daily_consumption: 100 })).toBe('low')
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 150, daily_consumption: 100 })).toBe('low')
        })

        it('returns plenty when total_quantity > 1.5x threshold', () => {
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 151, daily_consumption: 100 })).toBe('plenty')
            expect(computeInventoryStatus({ ...baseItem, total_quantity: 500, daily_consumption: 100 })).toBe('plenty')
        })

        it('falls back to existing status if both total_quantity and threshold are null', () => {
            expect(computeInventoryStatus({ ...baseItem, total_quantity: null, daily_consumption: null, status: 'low' })).toBe('low')
        })
    })
})
