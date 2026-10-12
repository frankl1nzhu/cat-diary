import { describe, expect, it } from 'vitest'
import { computeInventoryStatus, roundQuantity, type InventoryItem } from '../types/database.types'

describe('feedDeletionRestore', () => {
    function parseFeedMealType(mealType: string) {
        const parts = mealType.split('|')
        const itemName = parts[0]
        const grams = parts[1] ? parseFloat(parts[1]) : NaN
        return { itemName, grams, isValid: Boolean(itemName && !isNaN(grams) && grams > 0) }
    }

    function restoreInventoryStock(inv: InventoryItem, grams: number) {
        if (inv.total_quantity == null) return inv
        const restoredQty = roundQuantity(inv.total_quantity + grams, 1)
        const restoredStatus = computeInventoryStatus({ ...inv, total_quantity: restoredQty })
        return {
            ...inv,
            total_quantity: restoredQty,
            status: restoredStatus,
        }
    }

    it('correctly parses modern meal_type format and calculates restored quantity and status', () => {
        const parsed = parseFeedMealType('渴望猫粮|33.3')
        expect(parsed.isValid).toBe(true)
        expect(parsed.itemName).toBe('渴望猫粮')
        expect(parsed.grams).toBe(33.3)

        const inv: InventoryItem = {
            id: 'inv-1',
            cat_id: 'cat-1',
            item_name: '渴望猫粮',
            status: 'urgent',
            total_quantity: 0,
            daily_consumption: 50,
            updated_by: null,
            updated_at: new Date().toISOString(),
        }

        const restored = restoreInventoryStock(inv, parsed.grams)
        expect(restored.total_quantity).toBe(33.3)
        expect(restored.status).toBe('urgent') // still <= 50

        // If another 30g is restored:
        const restoredMore = restoreInventoryStock(restored, 30)
        expect(restoredMore.total_quantity).toBe(63.3)
        expect(restoredMore.status).toBe('low') // 50 < 63.3 <= 75 (1.5x)
    })

    it('safely handles legacy meal_type format like breakfast or snack', () => {
        const parsed = parseFeedMealType('breakfast')
        expect(parsed.isValid).toBe(false)
        expect(isNaN(parsed.grams)).toBe(true)
    })

    it('avoids floating point artifacts when restoring fractional grams', () => {
        const inv: InventoryItem = {
            id: 'inv-1',
            cat_id: 'cat-1',
            item_name: '猫条',
            status: 'plenty',
            total_quantity: 66.7,
            daily_consumption: 10,
            updated_by: null,
            updated_at: new Date().toISOString(),
        }

        const restored = restoreInventoryStock(inv, 33.3)
        expect(restored.total_quantity).toBe(100) // not 100.00000000000001
    })
})
