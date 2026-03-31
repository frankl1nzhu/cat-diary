import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { CatSwitcher } from './CatSwitcher'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import './AppLayout.css'

export function AppLayout() {
    const navigate = useNavigate()
    const online = useOnlineStatus()
    const mainRef = useRef<HTMLElement>(null)
    const [showScrollTop, setShowScrollTop] = useState(false)

    useEffect(() => {
        const el = mainRef.current
        if (!el) return

        const onScroll = () => {
            setShowScrollTop(el.scrollTop > 400)
        }

        el.addEventListener('scroll', onScroll, { passive: true })
        return () => el.removeEventListener('scroll', onScroll)
    }, [])

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

            const keyMap: Record<string, string> = {
                n: '/log?quick=diary',
                f: '/?quick=feed',
                p: '/?quick=poop',
                w: '/log?quick=weight',
            }

            const route = keyMap[event.key.toLowerCase()]
            if (route) {
                event.preventDefault()
                navigate(route)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [navigate])

    return (
        <div className="app-layout">
            <CatSwitcher />
            {!online && <div className="offline-banner">📡 当前离线，暂不可提交新记录</div>}
            <main ref={mainRef} className="app-main safe-area-inline safe-area-padding-bottom scroll-area">
                <Outlet />
            </main>
            <button
                className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
                onClick={scrollToTop}
                aria-label="回到顶部"
            >
                ↑
            </button>
            <BottomNav />
        </div>
    )
}
