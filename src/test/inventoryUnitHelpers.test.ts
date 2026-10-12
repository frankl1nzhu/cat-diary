import { describe, it, expect } from 'vitest'
import {
    unitToGrams,
    gramsToUnit,
    formatInventoryDisplay,
} from '../types/database.types'

describe('inventoryUnitHelpers', () => {
    describe('unitToGrams', () => {
        it('calculates grams from custom units like bags or cans', () => {
            expect(unitToGrams(1, 2000)).toBe(2000)
            expect(unitToGrams(0.5, 85)).toBe(42.5)
            expect(unitToGrams(2.5, 15)).toBe(37.5)
        })

        it('defaults to 1:1 if unit ratio is 1 or empty', () => {
            expect(unitToGrams(50, 1)).toBe(50)
            expect(unitToGrams(0, 100)).toBe(0)
        })
    })

    describe('gramsToUnit', () => {
        it('converts grams back to unit quantity with proper precision', () => {
            expect(gramsToUnit(4000, 2000)).toBe(2)
            expect(gramsToUnit(42.5, 85)).toBe(0.5)
            expect(gramsToUnit(150, 1)).toBe(150)
        })

        it('handles 0 or negative correctly', () => {
            expect(gramsToUnit(0, 2000)).toBe(0)
        })
    })

    describe('formatInventoryDisplay', () => {
        it('returns plain grams when unit is g', () => {
            expect(formatInventoryDisplay(500, 'g', 1)).toBe('500g')
        })

        it('returns dual display (grams and unit) when unit is not g and unitRatio > 1', () => {
            expect(formatInventoryDisplay(4000, '袋', 2000)).toBe('4000g (2袋)')
            expect(formatInventoryDisplay(85, '罐', 85)).toBe('85g (1罐)')
            expect(formatInventoryDisplay(42.5, '罐', 85)).toBe('42.5g (0.5罐)')
        })

        it('handles null gracefully', () => {
            expect(formatInventoryDisplay(null, '袋', 2000)).toBe('--')
        })
    })
})
