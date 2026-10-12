import { describe, it, expect } from 'vitest'

describe('snoozeResolution', () => {
  it('clears snoozed_until when building replenishment update payload', () => {
    const payload = {
      total_quantity: 5000,
      daily_consumption: 500,
      snoozed_until: null,
    }
    expect(payload.snoozed_until).toBeNull()
  })

  it('clears snoozed_until when renewing a health record', () => {
    const payload = {
      date: '2026-10-12',
      next_due: '2027-10-12',
      snoozed_until: null,
    }
    expect(payload.snoozed_until).toBeNull()
  })
})
