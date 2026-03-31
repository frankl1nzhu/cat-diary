import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { prefetchRoute } from '../../lib/prefetch'
import { lightHaptic } from '../../lib/haptics'
import './BottomNav.css'

const leftItems = [
    { to: '/', icon: '🏠', label: '首页' },
    { to: '/log', icon: '📝', label: '记录' },
]

const rightItems = [
    { to: '/stats', icon: '📊', label: '统计' },
    { to: '/settings', icon: '⚙️', label: '设置' },
]

const quickActions = [
    { label: '📝', sublabel: '写日记', path: '/log?quick=diary' as const, type: 'path' as const },
    { label: '💩', sublabel: '记便便', path: '/?quick=poop' as const, type: 'path' as const },
    { label: '🍽️', sublabel: '记喂食', path: '/?quick=feed' as const, type: 'path' as const },
    { label: '⚖️', sublabel: '记体重', path: '/log?quick=weight' as const, type: 'path' as const },
    { label: '🛒', sublabel: '新增库存', path: '/stats?quick=inventory' as const, type: 'path' as const },
    { label: '🩺', sublabel: '健康记录', path: '/stats?quick=health' as const, type: 'path' as const },
] as const

export function BottomNav({ hidden }: { hidden?: boolean }) {
    const navigate = useNavigate()
    const [quickOpen, setQuickOpen] = useState(false)
    const quickSheetRef = useRef<HTMLDivElement>(null)

    const onQuickAction = (action: { path: string; type: 'path' }) => {
        lightHaptic()
        setQuickOpen(false)
        navigate(action.path)
    }

    useEffect(() => {
        if (!quickOpen) return

        const focusable = quickSheetRef.current?.querySelectorAll<HTMLElement>('button')
        focusable?.[0]?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (!quickOpen) return
            if (event.key === 'Escape') {
                event.preventDefault()
                setQuickOpen(false)
                return
            }
            if (event.key !== 'Tab') return

            const list = quickSheetRef.current?.querySelectorAll<HTMLElement>('button')
            if (!list || list.length === 0) return

            const first = list[0]
            const last = list[list.length - 1]
            const active = document.activeElement
            if (event.shiftKey && active === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && active === last) {
                event.preventDefault()
                first.focus()
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [quickOpen])

    return (
        <>
            {quickOpen && <div className="quick-backdrop" onClick={() => setQuickOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setQuickOpen(false) }} role="button" tabIndex={-1} aria-label="关闭快速记录" />}
            {quickOpen && (
                <div className="quick-sheet fade-in" ref={quickSheetRef} role="dialog" aria-modal="true" aria-label="快速记录菜单">
                    <div className="quick-sheet-title">快速记录</div>
                    <div className="quick-grid">
                        {quickActions.map((action) => (
                            <button
                                key={action.path}
                                className="quick-item"
                                onClick={() => onQuickAction(action)}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{action.label}</span>
                                <span>{action.sublabel}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <nav className={`bottom-nav ${hidden && !quickOpen ? 'bottom-nav-hidden' : ''}`} id="bottom-nav">
                {leftItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        viewTransition
                        className={({ isActive }) =>
                            `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`
                        }
                        onPointerEnter={() => prefetchRoute(item.to)}
                        onFocus={() => prefetchRoute(item.to)}
                        onClick={() => lightHaptic()}
                    >
                        <span className="bottom-nav-icon">{item.icon}</span>
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                ))}

                <button className="bottom-nav-plus" onClick={() => { lightHaptic(); setQuickOpen((v) => !v) }} aria-label="快速记录">
                    ＋
                </button>

                {rightItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        viewTransition
                        className={({ isActive }) =>
                            `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`
                        }
                        onPointerEnter={() => prefetchRoute(item.to)}
                        onFocus={() => prefetchRoute(item.to)}
                        onClick={() => lightHaptic()}
                    >
                        <span className="bottom-nav-icon">{item.icon}</span>
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </>
    )
}
