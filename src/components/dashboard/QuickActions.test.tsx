import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
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
    sendScoopNotification: vi.fn().mockResolvedValue(undefined),
    sendFeedNotification: vi.fn().mockResolvedValue(undefined),
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

    it('opens the poop modal from the scoop button', () => {
        render(
            <MemoryRouter>
                <QuickActions {...baseProps} />
            </MemoryRouter>
        )

        fireEvent.click(screen.getByRole('button', { name: '🧹一键铲屎' }))

        expect(screen.getByText('💩 铲屎记录')).toBeInTheDocument()
    })

    it('opens the feed modal from the quick URL param', async () => {
        render(
            <MemoryRouter initialEntries={['/?quick=feed']}>
                <QuickActions {...baseProps} />
            </MemoryRouter>
        )

        await waitFor(() => {
            expect(screen.getByText('🍽️ 记录喂食')).toBeInTheDocument()
        })
    })
})