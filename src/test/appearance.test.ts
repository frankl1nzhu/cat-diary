import { describe, it, expect, beforeEach } from 'vitest'
import { getStoredAppearance, applyAppearanceMode } from '../lib/appearance'

describe('appearance manager', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme-mode')
  })

  it('defaults to system mode when nothing stored', () => {
    expect(getStoredAppearance()).toBe('system')
  })

  it('sets data-theme-mode attribute when applying dark or light', () => {
    applyAppearanceMode('dark')
    expect(document.documentElement.getAttribute('data-theme-mode')).toBe('dark')
    expect(localStorage.getItem('cat_diary_appearance')).toBe('dark')

    applyAppearanceMode('light')
    expect(document.documentElement.getAttribute('data-theme-mode')).toBe('light')
    expect(localStorage.getItem('cat_diary_appearance')).toBe('light')
  })
})
