import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import './BottomNav.css'

const leftItems = [
    { to: '/', icon: '🏠', label: '首页' },
    { to: '/log', icon: '📝', label: '记录' },
]

const rightItems = [
    { to: '/stats', icon: '📊', label: '统计' },
    { to: '/settings', icon: '⚙️', label: '设置' },
]

export function BottomNav() {
    const navigate = useNavigate()
    const [quickOpen, setQuickOpen] = useState(false)
    const quickSheetRef = useRef<HTMLDivElement>(null)

    const actions = [
        { label: '📝 写日记', path: '/log?quick=diary' },
        { label: '💩 记便便', path: '/?quick=poop' },
        { label: '🤮 记呕吐', path: '/stats?quick=vomit' },
        { label: '🍽️ 记喂食', path: '/?quick=feed' },
        { label: '⚖️ 记体重', path: '/log?quick=weight' },
    ]

    const onQuickAction = (path: string) => {
        setQuickOpen(false)
        navigate(path)
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
            {quickOpen && <div className="quick-backdrop" onClick={() => setQuickOpen(false)} />}
            {quickOpen && (
                <div className="quick-sheet fade-in" ref={quickSheetRef} role="dialog" aria-modal="true" aria-label="快速记录菜单">
                    <div className="quick-sheet-title">快速记录</div>
                    <div className="quick-grid">
                        {actions.map((action) => (
                            <button
                                key={action.path}
                                className="quick-item"
                                onClick={() => onQuickAction(action.path)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <nav className="bottom-nav" id="bottom-nav">
                {leftItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        className={({ isActive }) =>
                            `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`
                        }
                    >
                        <span className="bottom-nav-icon">{item.icon}</span>
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                ))}

                <button className="bottom-nav-plus" onClick={() => setQuickOpen((v) => !v)} aria-label="快速记录">
                    ＋
                </button>

                {rightItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`
                        }
                    >
                        <span className="bottom-nav-icon">{item.icon}</span>
                        <span className="bottom-nav-label">{item.label}</span>
                    </NavLink>
                ))}
            </nav>
        </>
    )
}
