import { useEffect, useRef, useState, useOptimistic, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { useToastStore } from '../../stores/useToastStore'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { getErrorMessage } from '../../lib/errorMessage'
import { lightHaptic } from '../../lib/haptics'
import { sendScoopNotification, sendFeedNotification, sendAbnormalPoopNotification, sendMissNotification } from '../../lib/pushServer'
import { BRISTOL_LABELS, POOP_COLOR_LABELS, MEAL_LABELS, isAbnormalPoop, getDiaryTagLabel } from '../../lib/constants'
import { useI18n } from '../../lib/i18n'
import { format } from 'date-fns'
import type { Cat, BristolType, PoopColor, FeedStatus, InventoryItem, DiaryEntry } from '../../types/database.types'
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
    const { language } = useI18n()
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()
    const [searchParams, setSearchParams] = useSearchParams()

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

    // Random diary entry state for "想咪了"
    const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([])
    const [randomDiary, setRandomDiary] = useState<DiaryEntry | null>(null)
    const [randomDiaryOpen, setRandomDiaryOpen] = useState(false)
    const text = language === 'zh'
        ? {
            feedSuccess: '喂食记录成功 🐾',
            feedFail: '喂食记录失败，请稍后重试',
            poopSuccess: '铲屎记录成功 💩',
            poopNotifyFail: '铲屎记录已保存，但家庭通知发送失败',
            poopFail: '铲屎记录失败，请稍后重试',
            missSuccess: '想咪 +1 🥹',
            missFail: '记录失败，请稍后重试',
            scoopQuick: '一键铲屎',
            missQuick: '想咪了',
            inventoryHint: '记得补货！',
            poopModalTitle: '💩 铲屎记录',
            bristolClass: '布里斯托分类',
            bristolAria: '布里斯托类型选择',
            color: '颜色',
            poopColorAria: '便便颜色选择',
            typePrefix: '类型',
            recording: '记录中...',
            saveRecord: '保存记录',
            feedModalTitle: '🍽️ 记录喂食',
            chooseMeal: '选择餐次',
            todayRecords: '今日记录',
            confirmFeed: '确认喂食 🐾',
            memoriesOf: (name: string) => `🥹 ${name}的回忆`,
            defaultCatName: '猫咪',
        }
        : {
            feedSuccess: 'Feeding saved 🐾',
            feedFail: 'Failed to save feeding. Please try again later.',
            poopSuccess: 'Poop log saved 💩',
            poopNotifyFail: 'Poop log saved, but family notification failed.',
            poopFail: 'Failed to save poop log. Please try again later.',
            missSuccess: 'Missing-you +1 🥹',
            missFail: 'Failed to save. Please try again later.',
            scoopQuick: 'Quick scoop',
            missQuick: 'I miss my cat',
            inventoryHint: 'Restock soon!',
            poopModalTitle: '💩 Poop Log',
            bristolClass: 'Bristol type',
            bristolAria: 'Choose bristol type',
            color: 'Color',
            poopColorAria: 'Choose poop color',
            typePrefix: 'Type',
            recording: 'Saving...',
            saveRecord: 'Save record',
            feedModalTitle: '🍽️ Feeding Log',
            chooseMeal: 'Choose meal',
            todayRecords: 'Today records',
            confirmFeed: 'Confirm feeding 🐾',
            memoriesOf: (name: string) => `🥹 ${name}'s memories`,
            defaultCatName: 'cat',
        }

    const mealLabels = language === 'zh'
        ? MEAL_LABELS
        : {
            breakfast: '🌅 Breakfast',
            lunch: '☀️ Lunch',
            dinner: '🌙 Dinner',
            snack: '🍬 Snack',
        }

    const poopColorLabels = language === 'zh'
        ? POOP_COLOR_LABELS
        : {
            brown: '🟫 Brown (normal)',
            dark_brown: '⬛ Dark brown',
            yellow: '🟨 Yellow',
            green: '🟩 Green',
            red: '🟥 Red ⚠️',
            black: '⬛ Black ⚠️',
            white: '⬜ White ⚠️',
        }

    const bristolLabels = language === 'zh'
        ? BRISTOL_LABELS
        : {
            '1': 'Hard pellets',
            '2': 'Lumpy sausage',
            '3': 'Cracked sausage',
            '4': 'Soft smooth log ✅',
            '5': 'Soft blobs',
            '6': 'Mushy',
            '7': 'Watery',
        }

    // Fetch diary entries once
    const fetchDiaryEntries = useCallback(async () => {
        if (!cat) return
        try {
            const { data } = await supabase
                .from('diary_entries')
                .select('*')
                .eq('cat_id', cat.id)
                .order('created_at', { ascending: false })
                .limit(200)
            if (data) {
                setDiaryEntries(data)
            }
        } catch { /* silent */ }
    }, [cat])

    useEffect(() => { fetchDiaryEntries() }, [fetchDiaryEntries])

    const openFeedModal = () => {
        setFeedModalOpen(true)
    }

    const openPoopModal = () => {
        setPoopModalOpen(true)
    }

    useEffect(() => {
        const quick = searchParams.get('quick')
        if (quick !== 'feed' && quick !== 'poop') return

        if (quick === 'feed') {
            openFeedModal()
        }

        if (quick === 'poop') {
            openPoopModal()
        }

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('quick')
            return next
        }, { replace: true })
    }, [searchParams, setSearchParams])

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
            pushToast('success', text.feedSuccess)
            sendFeedNotification(cat.id, cat.name, mealLabels[selectedMeal]).catch(() => { })
        } catch (err) {
            pushToast('error', getErrorMessage(err, text.feedFail))
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
            pushToast('success', text.poopSuccess)
            sendScoopNotification(cat.id, cat.name).catch(() => {
                pushToast('info', text.poopNotifyFail)
            })
            if (isAbnormalPoop(selectedBristol, selectedColor)) {
                sendAbnormalPoopNotification(cat.id, cat.name, selectedBristol, selectedColor).catch(() => { })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, text.poopFail))
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
            pushToast('success', text.missSuccess)
            sendMissNotification(cat.id, cat.name).catch(() => { })

            // Show a random diary entry
            if (diaryEntries.length > 0) {
                const randomIndex = Math.floor(Math.random() * diaryEntries.length)
                setRandomDiary(diaryEntries[randomIndex])
                setRandomDiaryOpen(true)
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, text.missFail))
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
                        <span className="quick-scoop-text">{text.scoopQuick}</span>
                    </button>
                    <button
                        className="quick-scoop-btn quick-miss-btn"
                        onClick={() => { void handleMissCat() }}
                        disabled={!cat || !online || missSaving}
                    >
                        <span className="quick-scoop-icon">🥹</span>
                        <span className="quick-scoop-text">{text.missQuick}</span>
                    </button>
                </div>
            </div>

            {/* Inventory Alert */}
            {lowInventory.length > 0 && (
                <div className="inventory-alert mx-4">
                    🛒 {lowInventory.map((i) => `${i.item_name}${computeInventoryStatus(i) === 'urgent' ? '🔴' : '🟡'}`).join(language === 'zh' ? '、' : ', ')} — {text.inventoryHint}
                </div>
            )}

            {/* Poop Modal */}
            <Modal isOpen={poopModalOpen} onClose={() => setPoopModalOpen(false)} title={text.poopModalTitle}>
                <div className="poop-form">
                    <div className="form-section">
                        <label className="form-label">{text.bristolClass}</label>
                        <select
                            className="form-input"
                            aria-label={text.bristolAria}
                            value={selectedBristol}
                            onChange={(e) => setSelectedBristol(e.target.value as BristolType)}
                        >
                            {(['1', '2', '3', '4', '5', '6', '7'] as BristolType[]).map((type) => (
                                <option key={type} value={type}>
                                    {text.typePrefix} {type} · {bristolLabels[type]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-section">
                        <label className="form-label">{text.color}</label>
                        <div className="color-grid compact" role="radiogroup" aria-label={text.poopColorAria}>
                            {(Object.entries(poopColorLabels) as [PoopColor, string][]).map(([color, label]) => (
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
                        {poopSaving ? text.recording : text.saveRecord}
                    </Button>
                </div>
            </Modal>

            {/* Feed Modal */}
            <Modal isOpen={feedModalOpen} onClose={() => setFeedModalOpen(false)} title={text.feedModalTitle}>
                <div className="feed-form">
                    <label className="form-label">{text.chooseMeal}</label>
                    <div className="meal-grid">
                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                            <button
                                key={meal}
                                className={`meal-btn ${selectedMeal === meal ? 'meal-btn-active' : ''}`}
                                onClick={() => setSelectedMeal(meal)}
                            >
                                {mealLabels[meal]}
                            </button>
                        ))}
                    </div>
                    {optimisticFeeds.length > 0 && (
                        <div className="feed-history">
                            <label className="form-label">{text.todayRecords}</label>
                            {optimisticFeeds.map((f) => (
                                <div key={f.id} className="feed-history-item">
                                    <span>{mealLabels[f.meal_type]}</span>
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
                        {feedLoading ? text.recording : text.confirmFeed}
                    </Button>
                </div>
            </Modal>

            {/* Random Diary Modal ("想咪了") */}
            <Modal isOpen={randomDiaryOpen} onClose={() => setRandomDiaryOpen(false)} title={text.memoriesOf(cat?.name || text.defaultCatName)}>
                {randomDiary && (
                    <div className="miss-diary-container">
                        {randomDiary.image_url && (
                            <img src={randomDiary.image_url} alt="" className="miss-diary-img" loading="lazy" />
                        )}
                        {randomDiary.text && (
                            <p className="miss-diary-text">{randomDiary.text}</p>
                        )}
                        {randomDiary.tags.length > 0 && (
                            <div className="diary-tags">
                                {randomDiary.tags.map((tag) => (
                                    <span key={tag} className="tag">#{getDiaryTagLabel(tag, language)}</span>
                                ))}
                            </div>
                        )}
                        <span className="text-muted text-xs">
                            {format(new Date(randomDiary.created_at), 'yyyy/MM/dd HH:mm')}
                        </span>
                    </div>
                )}
            </Modal>
        </>
    )
}

// Export ref handle for external triggers
QuickActions.displayName = 'QuickActions'
