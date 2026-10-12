import { describe, it, expect } from 'vitest'
import { isItemActivelySnoozed, computeSnoozeDisplay } from '../types/database.types'

describe('snoozeHelpers', () => {
  it('returns false when snoozed_until is null or undefined', () => {
    expect(isItemActivelySnoozed(null, '2026-10-12')).toBe(false)
    expect(isItemActivelySnoozed(undefined, '2026-10-12')).toBe(false)
  })

  it('returns true when snoozed_until is in the future relative to today', () => {
    expect(isItemActivelySnoozed('2026-10-15T12:00:00Z', '2026-10-12')).toBe(true)
  })

  it('returns false when snoozed_until is today or in the past (resurfaced)', () => {
    expect(isItemActivelySnoozed('2026-10-12T00:00:00Z', '2026-10-12')).toBe(false)
    expect(isItemActivelySnoozed('2026-10-10T00:00:00Z', '2026-10-12')).toBe(false)
  })

  it('computes correct display label for active and overdue snoozes', () => {
    const future = computeSnoozeDisplay('2026-10-15T00:00:00Z', '2026-10-12')
    expect(future).not.toBeNull()
    expect(future?.isActivelySnoozed).toBe(true)
    expect(future?.daysLeft).toBe(3)

    const today = computeSnoozeDisplay('2026-10-12T00:00:00Z', '2026-10-12')
    expect(today?.isActivelySnoozed).toBe(false)
    expect(today?.daysLeft).toBe(0)

    const overdue = computeSnoozeDisplay('2026-10-10T00:00:00Z', '2026-10-12')
    expect(overdue?.isActivelySnoozed).toBe(false)
    expect(overdue?.isOverdue).toBe(true)
    expect(overdue?.daysLeft).toBe(-2)
  })
})
