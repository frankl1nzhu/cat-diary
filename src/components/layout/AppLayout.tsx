import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { CatSwitcher } from './CatSwitcher'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import './AppLayout.css'

export function AppLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const online = useOnlineStatus()

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null
            const isTyping = target?.tagName === 'INPUT'
                || target?.tagName === 'TEXTAREA'
                || target?.tagName === 'SELECT'
                || target?.isContentEditable

            if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return

            const key = event.key.toLowerCase()
            if (key === 'n') {
                event.preventDefault()
                navigate('/log?quick=diary')
            }
            if (key === 'f') {
                event.preventDefault()
                navigate('/?quick=feed')
            }
            if (key === 'p') {
                event.preventDefault()
                navigate('/?quick=poop')
            }
            if (key === 'w') {
                event.preventDefault()
                navigate('/log?quick=weight')
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [location.pathname, navigate])

    return (
        <div className="app-layout">
            <CatSwitcher />
            {!online && <div className="offline-banner">📡 当前离线，暂不可提交新记录</div>}
            <main className="app-main safe-area-inline safe-area-padding-bottom scroll-area">
                <Outlet />
            </main>
            <BottomNav />
        </div>
    )
}
