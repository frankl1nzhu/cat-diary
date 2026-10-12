import { describe, it, expect, beforeEach } from 'vitest'
import { isSoundEnabled, setSoundEnabled } from '../lib/sound'

describe('sound module', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to enabled', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('persists enabled and disabled status', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })
})
