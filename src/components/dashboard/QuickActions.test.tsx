import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../../lib/i18n'
import { QuickActions } from './QuickActions'

vi.mock('../../lib/auth', () => ({
    useSession: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../../stores/useToastStore', () => ({
    useToastStore: (selector: (state: { pushToast: ReturnType<typeof vi.fn> }) => unknown) => selector({ pushToast: vi.fn() }),
}))

vi.mock('../../lib/useOnlineStatus', () => ({
    useOnlineStatus: () => true,
}))

vi.mock('../../lib/haptics', () => ({
    lightHaptic: vi.fn(),
}))

vi.mock('../../lib/pushServer', () => ({
    sendAbnormalPoopNotification: vi.fn().mockResolvedValue(undefined),
    sendMissNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: vi.fn(),
    },
}))

describe('QuickActions', () => {
    const baseProps = {
        cat: { id: 'cat-1', name: '咪咪' },
        todayFeeds: [],
        lowInventory: [],
        onDataChange: vi.fn().mockResolvedValue(undefined),
    }

    beforeEach(() => {
        window.localStorage.setItem('cat_diary_language', 'zh')
    })

    it('opens the poop modal from the scoop button', () => {
        render(
            <LanguageProvider>
                <MemoryRouter>
                    <QuickActions {...baseProps} />
                </MemoryRouter>
            </LanguageProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: /🧹\s*(一键铲屎|Quick scoop)/ }))

        expect(screen.getByText(/💩\s*(铲屎记录|Poop Log)/)).toBeInTheDocument()
    })

    it('opens the feed modal from the quick URL param', async () => {
        render(
            <LanguageProvider>
                <MemoryRouter initialEntries={['/?quick=feed']}>
                    <QuickActions {...baseProps} />
                </MemoryRouter>
            </LanguageProvider>
        )

        await waitFor(() => {
            expect(screen.getByText(/🍽️\s*(记录喂食|Feeding Log)/)).toBeInTheDocument()
        })
    })
})