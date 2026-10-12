import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AlertSummaryBar } from '../components/dashboard/AlertSummaryBar'
import { LanguageProvider } from '../lib/i18n'

import type { InventoryItem } from '../types/database.types'
import type { ExpiryReminderItem } from '../components/dashboard/ExpiryReminders'

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
                    lowInventory={[{ id: '1', item_name: '猫粮', status: 'urgent' } as unknown as InventoryItem]}
                    expiryReminders={[{ id: '2', item_name: '罐头', hoursLeft: 12, expires_at: '2026-10-15T12:00:00Z' } as unknown as ExpiryReminderItem]}
                    healthReminders={[]}
                    onSnooze={() => {}}
                />
            </LanguageProvider>
        )
        expect(screen.getByText(/2 项待处理/)).toBeDefined()
    })

    it('renders lazy_stretch empty state when expanded and all alerts are resolved', () => {
        const { rerender } = render(
            <LanguageProvider>
                <AlertSummaryBar
                    lowInventory={[{ id: '1', item_name: '猫粮', status: 'urgent' } as unknown as InventoryItem]}
                    expiryReminders={[{ id: '2', item_name: '罐头', hoursLeft: 12, expires_at: '2026-10-15T12:00:00Z' } as unknown as ExpiryReminderItem]}
                    healthReminders={[]}
                    onSnooze={() => {}}
                />
            </LanguageProvider>
        )

        // Click to expand
        const bar = screen.getByRole('button', { name: /2 项待处理/ })
        fireEvent.click(bar)
        expect(screen.getByText('收起')).toBeDefined()

        // Rerender with zero alerts while still expanded
        rerender(
            <LanguageProvider>
                <AlertSummaryBar
                    lowInventory={[]}
                    expiryReminders={[]}
                    healthReminders={[]}
                    onSnooze={() => {}}
                />
            </LanguageProvider>
        )

        expect(screen.getByText('所有预警已处理完毕')).toBeDefined()
        expect(screen.getByText('咪子很安心，伸个懒腰~')).toBeDefined()
    })
})
