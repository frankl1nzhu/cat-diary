import { describe, it, expect, beforeEach } from 'vitest'
import {
    getDashboardSectionConfig,
    setDashboardSectionCollapsed,
    setDashboardSectionHidden,
} from '../lib/dashboardSections'

describe('dashboardSections', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('returns default section config when empty', () => {
        const config = getDashboardSectionConfig()
        expect(config.collapsed.weekSummary).toBe(false)
        expect(config.hidden.weekSummary).toBe(false)
        expect(config.collapsed.quickActions).toBe(false)
        expect(config.hidden.quickActions).toBe(false)
    })

    it('updates collapsed state and persists to localStorage', () => {
        const updated = setDashboardSectionCollapsed('weekSummary', true)
        expect(updated.collapsed.weekSummary).toBe(true)

        const config = getDashboardSectionConfig()
        expect(config.collapsed.weekSummary).toBe(true)
    })

    it('updates hidden state and persists to localStorage', () => {
        const updated = setDashboardSectionHidden('latestDiary', true)
        expect(updated.hidden.latestDiary).toBe(true)

        const config = getDashboardSectionConfig()
        expect(config.hidden.latestDiary).toBe(true)
    })
})
