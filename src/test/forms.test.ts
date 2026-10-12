import { describe, it, expect } from 'vitest'
import { calculateFeedGrams, validateWeight } from '../components/forms/formHelpers'

describe('formHelpers', () => {
    describe('calculateFeedGrams', () => {
        it('calculates grams when in unit mode', () => {
            // 0.5 cans at 85g/can = 42.5g
            expect(calculateFeedGrams(0.5, 'unit', 85)).toBe(42.5)
            // 2 bags at 2000g/bag = 4000g
            expect(calculateFeedGrams(2, 'unit', 2000)).toBe(4000)
        })

        it('returns raw grams when in grams mode regardless of unit ratio', () => {
            expect(calculateFeedGrams(60, 'grams', 85)).toBe(60)
            expect(calculateFeedGrams(12.34, 'grams', 2000)).toBe(12.3)
        })

        it('handles invalid or zero inputs', () => {
            expect(calculateFeedGrams(0, 'unit', 85)).toBe(0)
            expect(calculateFeedGrams(-5, 'grams', 1)).toBe(0)
        })
    })

    describe('validateWeight', () => {
        it('validates normal cat weight ranges between 0.1 and 30 kg', () => {
            expect(validateWeight(4.5).valid).toBe(true)
            expect(validateWeight(0.1).valid).toBe(true)
            expect(validateWeight(30).valid).toBe(true)
        })

        it('rejects weights outside bounds or NaN', () => {
            expect(validateWeight(0).valid).toBe(false)
            expect(validateWeight(35).valid).toBe(false)
            expect(validateWeight(NaN).valid).toBe(false)
        })
    })
})
