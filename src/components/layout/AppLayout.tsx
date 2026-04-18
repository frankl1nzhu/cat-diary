import { useEffect, useRef, useState, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { QuickActionModals } from './QuickActionModals'
import { CatSwitcher } from './CatSwitcher'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { useI18n } from '../../lib/i18n'
import { useQuickActionStore, type QuickActionType } from '../../stores/useQuickActionStore'
import './AppLayout.css'

export function AppLayout() {
    const { t } = useI18n()
    const { pathname } = useLocation()
    const online = useOnlineStatus()
    const openAction = useQuickActionStore((s) => s.openAction)
    const mainRef = useRef<HTMLElement>(null)
    const [showScrollTop, setShowScrollTop] = useState(false)
    const [navHidden, setNavHidden] = useState(false)
    const lastScrollTop = useRef(0)
    const scrollDelta = useRef(0)

    const HIDE_THRESHOLD = 40  // px of downward scroll before hiding
    const SHOW_THRESHOLD = 20  // px of upward scroll before showing

    const handleScroll = useCallback(() => {
        const el = mainRef.current
        if (!el) return

        const currentTop = el.scrollTop
        setShowScrollTop(currentTop > 400)

        const diff = currentTop - lastScrollTop.current
        lastScrollTop.current = currentTop

        // Near top — always show nav
        if (currentTop < 80) {
            setNavHidden(false)
            scrollDelta.current = 0
            return
        }

        // Accumulate delta in the same direction, reset on direction change
        if ((diff > 0 && scrollDelta.current < 0) || (diff < 0 && scrollDelta.current > 0)) {
            scrollDelta.current = 0
        }
        scrollDelta.current += diff

        if (scrollDelta.current > HIDE_THRESHOLD) {
            setNavHidden(true)
            scrollDelta.current = 0
        } else if (scrollDelta.current < -SHOW_THRESHOLD) {
            setNavHidden(false)
            scrollDelta.current = 0
        }
    }, [])

    useEffect(() => {
        const el = mainRef.current
        if (!el) return

        el.addEventListener('scroll', handleScroll, { passive: true })
        return () => el.removeEventListener('scroll', handleScroll)
    }, [handleScroll])

    // Scroll to top when navigating to a new page
    useEffect(() => {
        mainRef.current?.scrollTo({ top: 0 })
    }, [pathname])

    const scrollToTop = () => {
        mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            const isTyping = target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.tagName === 'SELECT'
                || target?.isContentEditable

            if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return

            const keyMap: Record<string, NonNullable<QuickActionType>> = {
                n: 'diary',
                f: 'feed',
                p: 'poop',
                w: 'weight',
            }

            const action = keyMap[event.key.toLowerCase()]
            if (action) {
                event.preventDefault()
                openAction(action)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [openAction])

    return (
        <div className="app-layout">
            <a href="#main-content" className="skip-link">{t('layout.skipToContent')}</a>
            <CatSwitcher />
            {!online && <div className="offline-banner" role="alert">{t('layout.offlineBanner')}</div>}
            <main ref={mainRef} id="main-content" className="app-main safe-area-inline safe-area-padding-bottom scroll-area">
                <Outlet />
            </main>
            <button
                className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
                onClick={scrollToTop}
                aria-label={t('layout.scrollTop')}
            >
                ↑
            </button>
            <BottomNav hidden={navHidden} />
            <QuickActionModals />
        </div>
    )
}
