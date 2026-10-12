import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '../lib/i18n'
import { SnoozedAlertsDropdownList } from '../components/stats/SnoozedAlertsDropdown'

describe('SnoozedAlertsDropdownList', () => {
  it('renders nothing when list is empty', () => {
    const { container } = render(
      <LanguageProvider>
        <SnoozedAlertsDropdownList items={[]} onUnsnooze={vi.fn()} online={true} />
      </LanguageProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders snoozed items with icons, countdown, and restore button when non-empty', () => {
    const items = [
      {
        id: '1',
        type: 'inventory' as const,
        name: '渴望猫粮',
        snoozedUntil: '2026-10-15T00:00:00Z',
        daysLeft: 3,
      },
    ]
    render(
      <LanguageProvider>
        <SnoozedAlertsDropdownList items={items} onUnsnooze={vi.fn()} online={true} defaultExpanded={true} />
      </LanguageProvider>
    )
    expect(screen.getByText(/已延期提醒/)).toBeDefined()
    expect(screen.getByText('渴望猫粮')).toBeDefined()
    expect(screen.getByText(/剩余 3 天/)).toBeDefined()
    expect(screen.getByText('提前恢复')).toBeDefined()
  })
})
