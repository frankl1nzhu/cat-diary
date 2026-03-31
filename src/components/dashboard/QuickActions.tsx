import { useRef, useState, useOptimistic } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { useToastStore } from '../../stores/useToastStore'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { getErrorMessage } from '../../lib/errorMessage'
import { lightHaptic } from '../../lib/haptics'
import { sendScoopNotification, sendFeedNotification, sendAbnormalPoopNotification, sendMissNotification } from '../../lib/pushServer'
import { BRISTOL_LABELS, POOP_COLOR_LABELS, MEAL_LABELS, isAbnormalPoop } from '../../lib/constants'
import { format } from 'date-fns'
import type { Cat, BristolType, PoopColor, FeedStatus, InventoryItem } from '../../types/database.types'
import { computeInventoryStatus } from '../../types/database.types'

type RewardParticle = {
    id: number
    icon: '💖' | '🐾'
    dx: number
    dy: number
    delayMs: number
}

interface QuickActionsProps {
    cat: Cat | null
    todayFeeds: FeedStatus[]
    lowInventory: InventoryItem[]
    onDataChange: () => void
}

export function QuickActions({ cat, todayFeeds, lowInventory, onDataChange }: QuickActionsProps) {
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()

    // Feed modal
    const [feedModalOpen, setFeedModalOpen] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
    const [feedLoading, setFeedLoading] = useState(false)
    const [optimisticFeeds, addOptimisticFeed] = useOptimistic(
        todayFeeds,
        (current, newFeed: FeedStatus) => [newFeed, ...current],
    )
    // Poop modal
    const [poopModalOpen, setPoopModalOpen] = useState(false)
    const [selectedBristol, setSelectedBristol] = useState<BristolType>('4')
    const [selectedColor, setSelectedColor] = useState<PoopColor>('brown')
    const [poopSaving, setPoopSaving] = useState(false)
    const [missSaving, setMissSaving] = useState(false)

    // Reward animation
    const [rewardEmoji, setRewardEmoji] = useState<'💖' | '🐾' | null>(null)
    const [rewardParticles, setRewardParticles] = useState<RewardParticle[]>([])
    const particleIdRef = useRef(1)

    const triggerRewardBurst = (icon: '💖' | '🐾') => {
        setRewardEmoji(icon)
        window.setTimeout(() => setRewardEmoji(null), 1000)

        const particles: RewardParticle[] = Array.from({ length: 8 }).map(() => ({
            id: particleIdRef.current++,
            icon,
            dx: Math.round((Math.random() - 0.5) * 120),
            dy: -Math.round(36 + Math.random() * 90),
            delayMs: Math.round(Math.random() * 140),
        }))

        setRewardParticles((prev) => [...prev, ...particles])
        window.setTimeout(() => {
            const idSet = new Set(particles.map((p) => p.id))
            setRewardParticles((prev) => prev.filter((p) => !idSet.has(p.id)))
        }, 1200)
    }

    const handleFeedRecord = async () => {
        if (!cat || !user || feedLoading) return
        setFeedLoading(true)

        const optimisticFeed: FeedStatus = {
            id: crypto.randomUUID(),
            cat_id: cat.id,
            status: 'fed',
            fed_by: user.id,
            fed_at: new Date().toISOString(),
            meal_type: selectedMeal,
            updated_at: new Date().toISOString(),
        }

        addOptimisticFeed(optimisticFeed)
        try {
            await supabase.from('feed_status').insert({
                cat_id: cat.id,
                status: 'fed' as const,
                fed_by: user.id,
                fed_at: new Date().toISOString(),
                meal_type: selectedMeal,
            })
            setFeedModalOpen(false)
            await onDataChange()
            lightHaptic()
            triggerRewardBurst('🐾')
            pushToast('success', '喂食记录成功 🐾')
            sendFeedNotification(cat.id, cat.name, MEAL_LABELS[selectedMeal]).catch(() => {})
        } catch (err) {
            pushToast('error', getErrorMessage(err, '喂食记录失败，请稍后重试'))
        } finally {
            setFeedLoading(false)
        }
    }

    const handlePoopSave = async () => {
        if (!cat || !user || poopSaving) return
        setPoopSaving(true)

        try {
            await supabase.from('poop_logs').insert({
                cat_id: cat.id,
                bristol_type: selectedBristol,
                color: selectedColor,
                created_by: user.id,
            })
            setPoopModalOpen(false)
            setSelectedBristol('4')
            setSelectedColor('brown')
            lightHaptic()
            if (selectedBristol === '4') triggerRewardBurst('💖')
            pushToast('success', '铲屎记录成功 💩')
            sendScoopNotification(cat.id, cat.name).catch(() => {
                pushToast('info', '铲屎记录已保存，但家庭通知发送失败')
            })
            if (isAbnormalPoop(selectedBristol, selectedColor)) {
                sendAbnormalPoopNotification(cat.id, cat.name, selectedBristol, selectedColor).catch(() => {})
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '铲屎记录失败，请稍后重试'))
        } finally {
            setPoopSaving(false)
        }
    }

    const handleMissCat = async () => {
        if (!cat || !user || missSaving) return
        setMissSaving(true)
        try {
            await supabase.from('miss_logs').insert({
                cat_id: cat.id,
                created_by: user.id,
            })
            lightHaptic()
            triggerRewardBurst('💖')
            pushToast('success', '想咪 +1 🥹')
            sendMissNotification(cat.id, cat.name).catch(() => {})
        } catch (err) {
            pushToast('error', getErrorMessage(err, '记录失败，请稍后重试'))
        } finally {
            setMissSaving(false)
        }
    }

    return (
        <>
            {rewardEmoji && <div className="reward-burst">{rewardEmoji}</div>}
            {rewardParticles.length > 0 && (
                <div className="reward-particles" aria-hidden="true">
                    {rewardParticles.map((particle) => (
                        <span
                            key={particle.id}
                            className="reward-particle"
                            style={{
                                '--particle-dx': `${particle.dx}px`,
                                '--particle-dy': `${particle.dy}px`,
                                '--particle-delay': `${particle.delayMs}ms`,
                            } as React.CSSProperties}
                        >
                            {particle.icon}
                        </span>
                    ))}
                </div>
            )}

            {/* Quick Action Buttons */}
            <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                <div className="quick-action-row">
                    <button
                        className="quick-scoop-btn"
                        onClick={() => { lightHaptic(); openPoopModal() }}
                        disabled={!cat || !online}
                    >
                        <span className="quick-scoop-icon">🧹</span>
                        <span className="quick-scoop-text">一键铲屎</span>
                    </button>
                    <button
                        className="quick-scoop-btn quick-miss-btn"
                        onClick={() => { void handleMissCat() }}
                        disabled={!cat || !online || missSaving}
                    >
                        <span className="quick-scoop-icon">🥹</span>
                        <span className="quick-scoop-text">想咪了</span>
                    </button>
                </div>
            </div>

            {/* Inventory Alert */}
            {lowInventory.length > 0 && (
                <div className="inventory-alert mx-4">
                    🛒 {lowInventory.map((i) => `${i.item_name}${computeInventoryStatus(i) === 'urgent' ? '🔴' : '🟡'}`).join('、')} — 记得补货！
                </div>
            )}

            {/* Poop Modal */}
            <Modal isOpen={poopModalOpen} onClose={() => setPoopModalOpen(false)} title="💩 铲屎记录">
                <div className="poop-form">
                    <div className="form-section">
                        <label className="form-label">布里斯托分类</label>
                        <select
                            className="form-input"
                            aria-label="布里斯托类型选择"
                            value={selectedBristol}
                            onChange={(e) => setSelectedBristol(e.target.value as BristolType)}
                        >
                            {(['1', '2', '3', '4', '5', '6', '7'] as BristolType[]).map((type) => (
                                <option key={type} value={type}>
                                    类型 {type} · {BRISTOL_LABELS[type]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-section">
                        <label className="form-label">颜色</label>
                        <div className="color-grid compact" role="radiogroup" aria-label="便便颜色选择">
                            {(Object.entries(POOP_COLOR_LABELS) as [PoopColor, string][]).map(([color, label]) => (
                                <button
                                    key={color}
                                    className={`color-btn ${selectedColor === color ? 'color-btn-active' : ''}`}
                                    onClick={() => setSelectedColor(color)}
                                    role="radio"
                                    aria-checked={selectedColor === color}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <Button variant="primary" fullWidth onClick={handlePoopSave} disabled={poopSaving || !online}>
                        {poopSaving ? '记录中...' : '保存记录'}
                    </Button>
                </div>
            </Modal>

            {/* Feed Modal */}
            <Modal isOpen={feedModalOpen} onClose={() => setFeedModalOpen(false)} title="🍽️ 记录喂食">
                <div className="feed-form">
                    <label className="form-label">选择餐次</label>
                    <div className="meal-grid">
                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                            <button
                                key={meal}
                                className={`meal-btn ${selectedMeal === meal ? 'meal-btn-active' : ''}`}
                                onClick={() => setSelectedMeal(meal)}
                            >
                                {MEAL_LABELS[meal]}
                            </button>
                        ))}
                    </div>
                    {optimisticFeeds.length > 0 && (
                        <div className="feed-history">
                            <label className="form-label">今日记录</label>
                            {optimisticFeeds.map((f) => (
                                <div key={f.id} className="feed-history-item">
                                    <span>{MEAL_LABELS[f.meal_type]}</span>
                                    <span className="text-muted text-xs">{format(new Date(f.fed_at!), 'HH:mm')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleFeedRecord}
                        disabled={feedLoading || !online}
                    >
                        {feedLoading ? '记录中...' : '确认喂食 🐾'}
                    </Button>
                </div>
            </Modal>
        </>
    )
}

// Export ref handle for external triggers
QuickActions.displayName = 'QuickActions'
