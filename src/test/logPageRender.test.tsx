import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../lib/i18n'
import { LogPage } from '../pages/LogPage'

vi.mock('../lib/auth', () => ({
    useSession: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('../lib/useCat', () => ({
    useCat: () => ({
        cat: { id: 'cat-1', name: '咪咪' },
        catId: 'cat-1',
        loading: false,
    }),
}))

vi.mock('../stores/useToastStore', () => ({
    useToastStore: (selector: (state: { pushToast: ReturnType<typeof vi.fn> }) => unknown) =>
        selector({ pushToast: vi.fn() }),
}))

vi.mock('../lib/useOnlineStatus', () => ({
    useOnlineStatus: () => true,
}))

vi.mock('../lib/haptics', () => ({
    lightHaptic: vi.fn(),
}))

vi.mock('../lib/realtime', () => ({
    useRealtimeSubscription: vi.fn(),
}))

const mockDiaries = [
    {
        id: 'diary-1',
        cat_id: 'cat-1',
        created_by: 'user-1',
        created_at: '2026-10-15T10:00:00Z',
        text: '今天猫咪很乖',
        tags: ['cute'],
        image_url: null,
    },
]

const mockPoops = [
    {
        id: 'poop-1',
        cat_id: 'cat-1',
        created_by: 'user-1',
        created_at: '2026-10-15T09:00:00Z',
        bristol_type: 3,
        color: 'brown',
    },
]

const mockComments = [
    {
        id: 'comment-1',
        diary_id: 'diary-1',
        user_id: 'user-2',
        text: '确实很乖！第一条评论',
        created_at: '2026-10-15T10:05:00Z',
    },
    {
        id: 'comment-2',
        diary_id: 'diary-1',
        user_id: 'user-1',
        text: '第二条评论也很长很长很长',
        created_at: '2026-10-15T10:10:00Z',
    },
]

let customDiariesProvider: ((limit: number) => Promise<{ data: typeof mockDiaries; error: null }>) | null = null

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: vi.fn((table: string) => {
            if (table === 'diary_entries') {
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: (lim: number = 50) => {
                                    if (customDiariesProvider) {
                                        return customDiariesProvider(lim)
                                    }
                                    return Promise.resolve({ data: mockDiaries, error: null })
                                },
                            }),
                        }),
                    }),
                }
            }
            if (table === 'poop_logs') {
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({ data: mockPoops, error: null }),
                            }),
                        }),
                    }),
                }
            }
            if (table === 'weight_records') {
                return {
                    select: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: () => Promise.resolve({ data: [], error: null }),
                            }),
                        }),
                    }),
                }
            }
            if (table === 'feed_status') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({
                                order: () => ({
                                    limit: () => Promise.resolve({ data: [], error: null }),
                                }),
                            }),
                        }),
                    }),
                }
            }
            if (table === 'diary_comments') {
                return {
                    select: () => ({
                        in: () => ({
                            order: () => Promise.resolve({ data: mockComments, error: null }),
                        }),
                    }),
                }
            }
            if (table === 'diary_reactions') {
                return {
                    select: () => ({
                        in: () => Promise.resolve({ data: [], error: null }),
                    }),
                }
            }
            if (table === 'profiles') {
                return {
                    select: () => ({
                        in: () => Promise.resolve({
                            data: [
                                { id: 'user-1', username: '主人' },
                                { id: 'user-2', username: '家人' },
                            ],
                            error: null,
                        }),
                    }),
                }
            }
            return {
                select: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }),
                }),
            }
        }),
    },
}))

describe('LogPage Virtualization and Comments', () => {
    beforeEach(() => {
        window.localStorage.setItem('cat_diary_language', 'zh')
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
            configurable: true,
            get() {
                if (this.querySelector('.diary-comments-section')) {
                    return 380
                }
                if (this.classList.contains('diary-card-full') || this.querySelector('.diary-card-full')) {
                    return 160
                }
                return 100
            },
        })
    })

    it('renders diary and poop, then toggles comments', async () => {
        const { container } = render(
            <LanguageProvider>
                <MemoryRouter>
                    <LogPage />
                </MemoryRouter>
            </LanguageProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('今天猫咪很乖')).toBeInTheDocument()
        })

        // Check comment button shows comment count
        const commentToggle = await screen.findByText(/2\s*条评论/)
        expect(commentToggle).toBeInTheDocument()

        // Before expanding: element 0 at translateY(0px), element 1 at translateY(160px)
        const virtualElementsBefore = container.querySelectorAll('.timeline-virtual-container > div')
        expect(virtualElementsBefore.length).toBe(2)
        expect((virtualElementsBefore[0] as HTMLElement).style.transform).toBe('translateY(0px)')
        expect((virtualElementsBefore[1] as HTMLElement).style.transform).toBe('translateY(160px)')

        // Expand comments
        fireEvent.click(commentToggle)

        await waitFor(() => {
            expect(screen.getByText('确实很乖！第一条评论')).toBeInTheDocument()
        })

        // After expanding: element 0 still at translateY(0px), element 1 moved down to translateY(380px)
        await waitFor(() => {
            const virtualElementsAfter = container.querySelectorAll('.timeline-virtual-container > div')
            expect(virtualElementsAfter.length).toBe(2)
            expect((virtualElementsAfter[0] as HTMLElement).style.transform).toBe('translateY(0px)')
            expect((virtualElementsAfter[1] as HTMLElement).style.transform).toBe('translateY(380px)')
        })

        // Collapse comments back
        fireEvent.click(commentToggle)

        await waitFor(() => {
            expect(screen.queryByText('确实很乖！第一条评论')).not.toBeInTheDocument()
        })

        // After collapsing: element 1 moves back up to translateY(160px)
        await waitFor(() => {
            const virtualElementsCollapsed = container.querySelectorAll('.timeline-virtual-container > div')
            expect(virtualElementsCollapsed.length).toBe(2)
            expect((virtualElementsCollapsed[0] as HTMLElement).style.transform).toBe('translateY(0px)')
            expect((virtualElementsCollapsed[1] as HTMLElement).style.transform).toBe('translateY(160px)')
        })
    })

    it('keeps date filters empty by default and shows older records when clicking load more', async () => {
        const fiftyDiaries = Array.from({ length: 50 }, (_, i) => ({
            id: `diary-${i + 1}`,
            cat_id: 'cat-1',
            created_by: 'user-1',
            created_at: `2026-10-15T10:${String(i).padStart(2, '0')}:00Z`,
            text: `日记记录 #${i + 1}`,
            tags: ['cute'],
            image_url: null,
        }))

        const olderDiary = {
            id: 'diary-older',
            cat_id: 'cat-1',
            created_by: 'user-1',
            created_at: '2026-09-01T10:00:00Z',
            text: '九月的猫咪旧记录',
            tags: [],
            image_url: null,
        }

        customDiariesProvider = async (limit: number) => {
            if (limit > 50) {
                return { data: [...fiftyDiaries, olderDiary], error: null }
            }
            return { data: fiftyDiaries, error: null }
        }

        render(
            <LanguageProvider>
                <MemoryRouter>
                    <main id="main-content" className="app-main">
                        <LogPage />
                    </main>
                </MemoryRouter>
            </LanguageProvider>
        )

        await waitFor(() => {
            expect(screen.getByText('日记记录 #50')).toBeInTheDocument()
        })

        const startDateInput = screen.getByLabelText('开始日期') as HTMLInputElement
        const endDateInput = screen.getByLabelText('结束日期') as HTMLInputElement

        // Date inputs must NOT be auto-filled, which would block older records
        expect(startDateInput.value).toBe('')
        expect(endDateInput.value).toBe('')

        // Click load more button
        const loadMoreBtn = await screen.findByRole('button', { name: '加载更多' })
        expect(loadMoreBtn).toBeInTheDocument()
        fireEvent.click(loadMoreBtn)

        const mainEl = screen.getByRole('main')
        mainEl.scrollTop = 7500
        fireEvent.scroll(mainEl)

        await waitFor(() => {
            expect(screen.getByText('九月的猫咪旧记录')).toBeInTheDocument()
            expect(screen.queryByText('日记记录 #50')).not.toBeInTheDocument()
        })

        customDiariesProvider = null
    })
})

