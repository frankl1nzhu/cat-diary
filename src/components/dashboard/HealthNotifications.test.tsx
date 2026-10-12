import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HealthNotifications, type HealthNotifyItem } from './HealthNotifications'
import { LanguageProvider } from '../../lib/i18n'

describe('HealthNotifications', () => {
    const mockRenew = {
        renewModalOpen: false,
        openRenewModal: vi.fn(),
        closeRenewModal: vi.fn(),
        renewRecord: null,
        renewNextDue: '',
        setRenewNextDue: vi.fn(),
        renewNotes: '',
        setRenewNotes: vi.fn(),
        renewSaving: false,
        handleRenewSubmit: vi.fn(),
        handleStopReminder: vi.fn(),
        stopSaving: null,
    }

    const item: HealthNotifyItem = {
        id: 'rec-1',
        cat_id: 'cat-1',
        type: 'vaccine',
        name: '狂犬疫苗',
        date: '2026-01-01',
        next_due: '2026-10-15',
        notes: null,
        created_by: 'u1',
        created_at: new Date().toISOString(),
        daysLeft: 2,
    }

    it('renders null when items is empty, and does not crash when re-rendered with items', () => {
        const { rerender } = render(
            <LanguageProvider>
                <HealthNotifications items={[]} renew={mockRenew} online={true} />
            </LanguageProvider>
        )

        expect(screen.queryByText(/健康提醒|Health Notifications/)).not.toBeInTheDocument()

        // Re-render with items to ensure no hook count violations
        rerender(
            <LanguageProvider>
                <HealthNotifications items={[item]} renew={mockRenew} online={true} />
            </LanguageProvider>
        )

        expect(screen.getByText(/狂犬疫苗/)).toBeInTheDocument()
    })
})
