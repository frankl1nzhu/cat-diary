import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { useCat } from '../../lib/useCat'
import { useToastStore } from '../../stores/useToastStore'
import { getErrorMessage } from '../../lib/errorMessage'
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
    { label: '📝 写日记', path: '/log?quick=diary' as const, type: 'path' as const },
    { label: '💩 记便便', path: '/?quick=poop' as const, type: 'path' as const },
    { label: '🤮 记呕吐', path: '/stats' as const, type: 'vomit' as const },
    { label: '🍽️ 记喂食', path: '/?quick=feed' as const, type: 'path' as const },
    { label: '⚖️ 记体重', path: '/log?quick=weight' as const, type: 'path' as const },
] as const

export function BottomNav() {
    const navigate = useNavigate()
    const { user } = useSession()
    const { catId } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const [quickOpen, setQuickOpen] = useState(false)
    const [vomitSaving, setVomitSaving] = useState(false)
    const quickSheetRef = useRef<HTMLDivElement>(null)

    const onQuickAction = async (action: { path: string; type: 'path' | 'vomit' }) => {
        if (action.type === 'vomit') {
            if (!catId || !user) {
                pushToast('error', '请先创建猫咪档案后再记录')
                return
            }

            setVomitSaving(true)
            try {
                const { error } = await supabase.from('health_records').insert({
                    cat_id: catId,
                    type: 'medical',
                    name: '呕吐',
                    date: new Date().toISOString().split('T')[0],
                    next_due: null,
                    created_by: user.id,
                })
                if (error) throw error
                setQuickOpen(false)
                pushToast('success', '已快速记录呕吐 🤮')
            } catch (err) {
                pushToast('error', getErrorMessage(err, '记录失败，请稍后重试'))
            } finally {
                setVomitSaving(false)
            }
            return
        }

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
                                onClick={() => void onQuickAction(action)}
                                disabled={action.type === 'vomit' && vomitSaving}
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
