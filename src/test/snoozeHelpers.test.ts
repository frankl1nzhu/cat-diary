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

  it('computes correct display label for active and overdue snoozes in zh and en', () => {
    const future = computeSnoozeDisplay('2026-10-15T00:00:00Z', '2026-10-12', 'zh')
    expect(future).not.toBeNull()
    expect(future?.isActivelySnoozed).toBe(true)
    expect(future?.daysLeft).toBe(3)
    expect(future?.displayLabel).toBe('延期至 10/15（剩余 3 天）')

    const today = computeSnoozeDisplay('2026-10-12T00:00:00Z', '2026-10-12', 'zh')
    expect(today?.isActivelySnoozed).toBe(false)
    expect(today?.daysLeft).toBe(0)
    expect(today?.displayLabel).toBe('延期至 10/12（今日到期）')

    const overdue = computeSnoozeDisplay('2026-10-10T00:00:00Z', '2026-10-12', 'zh')
    expect(overdue?.isActivelySnoozed).toBe(false)
    expect(overdue?.isOverdue).toBe(true)
    expect(overdue?.daysLeft).toBe(-2)
    expect(overdue?.displayLabel).toBe('延期至 10/10（已逾期 2 天）')

    // English assertions
    const futureEn = computeSnoozeDisplay('2026-10-15T00:00:00Z', '2026-10-12', 'en')
    expect(futureEn?.displayLabel).toBe('Snoozed to 10/15 (3d left)')

    const todayEn = computeSnoozeDisplay('2026-10-12T00:00:00Z', '2026-10-12', 'en')
    expect(todayEn?.displayLabel).toBe('Snoozed to 10/12 (Due today)')

    const overdueEn = computeSnoozeDisplay('2026-10-10T00:00:00Z', '2026-10-12', 'en')
    expect(overdueEn?.displayLabel).toBe('Snoozed to 10/10 (Overdue 2d)')
  })
})
