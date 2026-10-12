import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertSummaryBar } from '../components/dashboard/AlertSummaryBar'
import { LanguageProvider } from '../lib/i18n'

describe('AlertSummaryBar', () => {
    it('renders nothing when activeAlertCount is 0', () => {
        const { container } = render(
            <LanguageProvider>
                <AlertSummaryBar
                    lowInventory={[]}
                    expiryReminders={[]}
                    healthReminders={[]}
                    onSnooze={() => {}}
                />
            </LanguageProvider>
        )
        expect(container.firstChild).toBeNull()
    })

    it('renders compact summary bar when multiple alerts exist', () => {
        render(
            <LanguageProvider>
                <AlertSummaryBar
                    lowInventory={[{ id: '1', item_name: '猫粮', status: 'urgent' } as any]}
                    expiryReminders={[{ id: '2', item_name: '罐头', hoursLeft: 12 } as any]}
                    healthReminders={[]}
                    onSnooze={() => {}}
                />
            </LanguageProvider>
        )
        expect(screen.getByText(/2 项待处理/)).toBeDefined()
    })
})
