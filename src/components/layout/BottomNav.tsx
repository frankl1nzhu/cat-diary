import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { prefetchRoute } from '../../lib/prefetch'
import { lightHaptic } from '../../lib/haptics'
import { useI18n } from '../../lib/i18n'
import { useQuickActionStore, type QuickActionType } from '../../stores/useQuickActionStore'
import './BottomNav.css'

const leftItems = [
    { to: '/', icon: '🏠', labelKey: 'nav.home' },
    { to: '/log', icon: '📝', labelKey: 'nav.log' },
]

const rightItems = [
    { to: '/stats', icon: '📊', labelKey: 'nav.stats' },
    { to: '/settings', icon: '⚙️', labelKey: 'nav.settings' },
]

const quickActions: { label: string; sublabelKey: string; action: NonNullable<QuickActionType> }[] = [
    { label: '📝', sublabelKey: 'quick.writeDiary', action: 'diary' },
    { label: '💩', sublabelKey: 'quick.logPoop', action: 'poop' },
    { label: '🍽️', sublabelKey: 'quick.logFeed', action: 'feed' },
    { label: '⚖️', sublabelKey: 'quick.logWeight', action: 'weight' },
    { label: '🛒', sublabelKey: 'quick.addInventory', action: 'inventory' },
    { label: '🩺', sublabelKey: 'quick.healthRecord', action: 'health' },
    { label: '🗑️', sublabelKey: 'quick.expiryReminder', action: 'expiry' },
]

export function BottomNav({ hidden }: { hidden?: boolean }) {
    const { t } = useI18n()
    const openAction = useQuickActionStore((s) => s.openAction)
    const [quickOpen, setQuickOpen] = useState(false)
    const quickSheetRef = useRef<HTMLDivElement>(null)

    const onQuickAction = (action: NonNullable<QuickActionType>) => {
        lightHaptic()
        setQuickOpen(false)
        openAction(action)
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
            {quickOpen && <div className="quick-backdrop" onClick={() => setQuickOpen(false)} onKeyDown={(e) => { if (e.key === 'Escape') setQuickOpen(false) }} role="button" tabIndex={-1} aria-label={t('quick.close')} />}
            {quickOpen && (
                <div className="quick-sheet fade-in" ref={quickSheetRef} role="dialog" aria-modal="true" aria-label={t('quick.menu')}>
                    <div className="quick-sheet-title">{t('quick.title')}</div>
                    <div className="quick-grid">
                        {quickActions.map((action) => (
                            <button
                                key={action.action}
                                className="quick-item"
                                onClick={() => onQuickAction(action.action)}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{action.label}</span>
                                <span>{t(action.sublabelKey)}</span>
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
                        <span className="bottom-nav-label">{t(item.labelKey)}</span>
                    </NavLink>
                ))}

                <button className="bottom-nav-plus" onClick={() => { lightHaptic(); setQuickOpen((v) => !v) }} aria-label={t('quick.open')}>
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
                        <span className="bottom-nav-label">{t(item.labelKey)}</span>
                    </NavLink>
                ))}
            </nav>
        </>
    )
}
