import { roundQuantity, unitToGrams } from '../../types/database.types'

/**
 * Calculate consumption in grams given an input value, input mode, and unit ratio.
 */
export function calculateFeedGrams(
    inputValue: number,
    inputMode: 'unit' | 'grams',
    unitRatio: number = 1,
): number {
    if (isNaN(inputValue) || inputValue <= 0) return 0
    if (inputMode === 'grams') {
        return roundQuantity(inputValue, 1)
    }
    return unitToGrams(inputValue, unitRatio)
}

/**
 * Validate weight in kilograms (0.1kg - 30kg).
 */
export function validateWeight(kg: number): { valid: boolean; error?: string } {
    if (isNaN(kg) || kg < 0.1 || kg > 30) {
        return { valid: false, error: 'Weight range 0.1-30 kg' }
    }
    return { valid: true }
}
