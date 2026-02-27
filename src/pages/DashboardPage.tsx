import { useState, useEffect, useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useRealtimeSubscription } from '../lib/realtime'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { differenceInDays, format, addMonths } from 'date-fns'
import type { Cat, MoodType, BristolType, PoopColor, DiaryEntry, InventoryItem, FeedStatus } from '../types/database.types'
import './DashboardPage.css'

export function DashboardPage() {
    const { user } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)

    const [cat, setCat] = useState<Cat | null>(null)
    const [todayFeeds, setTodayFeeds] = useState<FeedStatus[]>([])

    // Feed modal
    const [feedModalOpen, setFeedModalOpen] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
    const [todayMood, setTodayMood] = useState<MoodType | null>(null)
    const [latestDiary, setLatestDiary] = useState<DiaryEntry | null>(null)
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [nextDeworming, setNextDeworming] = useState<string | null>(null)

    // Poop modal
    const [poopModalOpen, setPoopModalOpen] = useState(false)
    const [selectedBristol, setSelectedBristol] = useState<BristolType>(4)
    const [selectedColor, setSelectedColor] = useState<PoopColor>('brown')
    const [poopSaving, setPoopSaving] = useState(false)

    const [feedLoading, setFeedLoading] = useState(false)
    const [moodSaving, setMoodSaving] = useState(false)

    const today = new Date().toISOString().split('T')[0]

    // ─── Load all data ────────────────────────────
    const loadData = useCallback(async () => {
        // Load cat
        const { data: catData } = await supabase
            .from('cats')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(1)
            .single()

        if (catData) {
            setCat(catData)
            setCurrentCatId(catData.id)

            // Load today's feed records
            const { data: feedData } = await supabase
                .from('feed_status')
                .select('*')
                .eq('cat_id', catData.id)
                .gte('updated_at', `${today}T00:00:00`)
                .order('fed_at', { ascending: false })

            if (feedData) setTodayFeeds(feedData)

            // Load today's mood
            const { data: moodData } = await supabase
                .from('mood_logs')
                .select('*')
                .eq('cat_id', catData.id)
                .eq('date', today)
                .limit(1)
                .single()

            if (moodData) setTodayMood(moodData.mood)

            // Load latest diary
            const { data: diaryData } = await supabase
                .from('diary_entries')
                .select('*')
                .eq('cat_id', catData.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (diaryData) setLatestDiary(diaryData)

            // Load inventory
            const { data: invData } = await supabase
                .from('inventory')
                .select('*')
                .eq('cat_id', catData.id)

            if (invData) setInventory(invData)

            // Load next deworming
            const { data: healthData } = await supabase
                .from('health_records')
                .select('*')
                .eq('cat_id', catData.id)
                .eq('type', 'deworming')
                .order('date', { ascending: false })
                .limit(1)
                .single()

            if (healthData) {
                // Auto-calculate next due (3 months after last)
                const nextDue = healthData.next_due || format(addMonths(new Date(healthData.date), 3), 'yyyy-MM-dd')
                setNextDeworming(nextDue)
            }
        }
    }, [today, setCurrentCatId])

    useEffect(() => {
        loadData()
    }, [loadData])

    // ─── Realtime subscriptions ───────────────────
    useRealtimeSubscription('feed_status', () => {
        loadData()
    }, currentCatId ? `cat_id=eq.${currentCatId}` : undefined)

    useRealtimeSubscription('mood_logs', () => {
        loadData()
    }, currentCatId ? `cat_id=eq.${currentCatId}` : undefined)

    // ─── Countdown calculations ───────────────────
    const calcCountdowns = () => {
        if (!cat) return { daysHome: null, daysToBirthday: null, daysToDeworming: null }

        const now = new Date()

        // Days at home
        let daysHome: number | null = null
        if (cat.adopted_at) {
            daysHome = differenceInDays(now, new Date(cat.adopted_at))
        }

        // Days to next birthday
        let daysToBirthday: number | null = null
        if (cat.birthday) {
            const bday = new Date(cat.birthday)
            const nextBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
            if (nextBday < now) nextBday.setFullYear(nextBday.getFullYear() + 1)
            daysToBirthday = differenceInDays(nextBday, now)
        }

        // Days to next deworming
        let daysToDeworming: number | null = null
        if (nextDeworming) {
            daysToDeworming = differenceInDays(new Date(nextDeworming), now)
        }

        return { daysHome, daysToBirthday, daysToDeworming }
    }

    const { daysHome, daysToBirthday, daysToDeworming } = calcCountdowns()

    // ─── Feed record ─────────────────────────────
    const handleFeedRecord = async () => {
        if (!cat || !user || feedLoading) return
        setFeedLoading(true)

        try {
            await supabase.from('feed_status').insert({
                cat_id: cat.id,
                status: 'fed' as const,
                fed_by: user.id,
                fed_at: new Date().toISOString(),
                meal_type: selectedMeal,
            })
            setFeedModalOpen(false)
            await loadData()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '喂食记录失败，请稍后重试'))
        } finally {
            setFeedLoading(false)
        }
    }

    const mealLabels: Record<string, string> = {
        breakfast: '🌅 早餐',
        lunch: '☀️ 午餐',
        dinner: '🌙 晚餐',
        snack: '🍬 加餐',
    }

    // ─── Mood picker ──────────────────────────────
    const handleMoodPick = async (mood: MoodType) => {
        if (!cat || !user || moodSaving) return
        setMoodSaving(true)

        try {
            // Upsert mood for today
            await supabase
                .from('mood_logs')
                .upsert(
                    {
                        cat_id: cat.id,
                        mood,
                        date: today,
                        created_by: user.id,
                    },
                    { onConflict: 'cat_id,date' }
                )
            setTodayMood(mood)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '心情记录失败，请稍后重试'))
        } finally {
            setMoodSaving(false)
        }
    }

    // ─── Poop log ─────────────────────────────────
    const handlePoopSave = async () => {
        if (!cat || !user || poopSaving) return
        setPoopSaving(true)

        try {
            await supabase.from('poop_logs').insert({
                cat_id: cat.id,
                bristol_type: String(selectedBristol) as '1' | '2' | '3' | '4' | '5' | '6' | '7',
                color: selectedColor,
                created_by: user.id,
            })
            setPoopModalOpen(false)
            setSelectedBristol(4)
            setSelectedColor('brown')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '铲屎记录失败，请稍后重试'))
        } finally {
            setPoopSaving(false)
        }
    }

    // ─── Bristol type descriptions ────────────────
    const bristolLabels: Record<number, string> = {
        1: '硬球状',
        2: '腊肠状硬块',
        3: '腊肠状裂纹',
        4: '软条状 ✅',
        5: '软团状',
        6: '泥状',
        7: '水状',
    }

    const colorLabels: Record<PoopColor, string> = {
        brown: '🟫 棕色（正常）',
        dark_brown: '⬛ 深棕色',
        yellow: '🟨 黄色',
        green: '🟩 绿色',
        red: '🟥 红色 ⚠️',
        black: '⬛ 黑色 ⚠️',
        white: '⬜ 白色 ⚠️',
    }

    // ─── Inventory alerts ─────────────────────────
    const lowInventory = inventory.filter((i) => i.status !== 'plenty')

    return (
        <div className="dashboard fade-in">
            {/* ── Cat Profile Card ── */}
            <Card variant="accent" padding="lg" className="cat-profile-card">
                <div className="profile-header">
                    <div className="avatar-placeholder">
                        {cat?.avatar_url ? (
                            <img src={cat.avatar_url} alt={cat.name} className="avatar-img" />
                        ) : (
                            <span className="avatar-emoji">🐱</span>
                        )}
                    </div>
                    <div className="profile-info">
                        <h1 className="cat-name">{cat?.name || '添加猫咪'}</h1>
                        <p className="cat-breed text-sm">{cat?.breed || '在设置中编辑档案'}</p>
                    </div>
                </div>
                <div className="countdown-row">
                    <div className="countdown-item">
                        <span className="countdown-number">{daysHome !== null ? `${daysHome}天` : '—'}</span>
                        <span className="countdown-label">来到这个家</span>
                    </div>
                    <div className="countdown-item">
                        <span className="countdown-number">{daysToBirthday !== null ? `${daysToBirthday}天` : '—'}</span>
                        <span className="countdown-label">下次生日</span>
                    </div>
                    <div className="countdown-item">
                        <span className="countdown-number">
                            {daysToDeworming !== null ? (
                                <span className={daysToDeworming <= 7 ? 'text-danger' : ''}>
                                    {daysToDeworming}天
                                </span>
                            ) : '—'}
                        </span>
                        <span className="countdown-label">下次驱虫</span>
                    </div>
                </div>
            </Card>

            {/* ── Inventory Alert Banner ── */}
            {lowInventory.length > 0 && (
                <div className="inventory-alert mx-4">
                    🛒 {lowInventory.map((i) => `${i.item_name}${i.status === 'urgent' ? '🔴' : '🟡'}`).join('、')} — 记得补货！
                </div>
            )}

            {/* ── Quick Actions Bento Grid ── */}
            <div className="bento-grid">
                {/* Feed Status */}
                <Card variant="glass" className="bento-item" onClick={() => setFeedModalOpen(true)}>
                    <div className="bento-icon">🍽️</div>
                    <div className="bento-label">记录喂食</div>
                    {todayFeeds.length > 0 ? (
                        <>
                            <StatusBadge status="fed" size="sm" label={`今日${todayFeeds.length}次`} />
                            <span className="feed-time text-muted text-xs">
                                最近 {format(new Date(todayFeeds[0].fed_at!), 'HH:mm')}
                            </span>
                        </>
                    ) : (
                        <StatusBadge status="not_fed" size="sm" />
                    )}
                </Card>

                {/* Poop Button */}
                <Card variant="glass" className="bento-item poop-card" onClick={() => setPoopModalOpen(true)}>
                    <div className="bento-icon poop-icon">💩</div>
                    <div className="bento-label">一键铲屎</div>
                </Card>

                {/* Mood Picker */}
                <Card variant="glass" className="bento-item span-2">
                    <div className="bento-label mb-2">
                        今日心情 {todayMood && <span className="current-mood">{todayMood}</span>}
                    </div>
                    <div className="mood-picker">
                        {(['😸', '😾', '😴'] as MoodType[]).map((mood) => (
                            <button
                                key={mood}
                                className={`mood-btn ${todayMood === mood ? 'mood-btn-active' : ''}`}
                                onClick={() => handleMoodPick(mood)}
                                disabled={moodSaving}
                                aria-label={mood}
                            >
                                {mood}
                            </button>
                        ))}
                    </div>
                </Card>
            </div>

            {/* ── Latest Diary ── */}
            <div className="section-header px-4">
                <h2 className="text-lg font-semibold">最近动态</h2>
            </div>
            <div className="px-4">
                <Card variant="default" padding="md">
                    {latestDiary ? (
                        <div className="diary-snippet">
                            {latestDiary.image_url && (
                                <img src={latestDiary.image_url} alt="" className="diary-img" />
                            )}
                            <p className="text-sm">{latestDiary.text || '(无文字)'}</p>
                            {latestDiary.tags.length > 0 && (
                                <div className="diary-tags">
                                    {latestDiary.tags.map((tag) => (
                                        <span key={tag} className="tag">#{tag}</span>
                                    ))}
                                </div>
                            )}
                            <span className="text-muted text-xs">
                                {format(new Date(latestDiary.created_at), 'MM/dd HH:mm')}
                            </span>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <span className="empty-icon">📸</span>
                            <p className="text-secondary text-sm">还没有日记，去记录页添加第一条吧！</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Poop Modal ── */}
            <Modal isOpen={poopModalOpen} onClose={() => setPoopModalOpen(false)} title="💩 铲屎记录">
                <div className="poop-form">
                    <div className="form-section">
                        <label className="form-label">布里斯托分类</label>
                        <div className="bristol-grid">
                            {([1, 2, 3, 4, 5, 6, 7] as BristolType[]).map((type) => (
                                <button
                                    key={type}
                                    className={`bristol-btn ${selectedBristol === type ? 'bristol-btn-active' : ''} ${type >= 6 ? 'bristol-btn-warn' : ''}`}
                                    onClick={() => setSelectedBristol(type)}
                                >
                                    <span className="bristol-num">{type}</span>
                                    <span className="bristol-label">{bristolLabels[type]}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-section">
                        <label className="form-label">颜色</label>
                        <div className="color-grid">
                            {(Object.entries(colorLabels) as [PoopColor, string][]).map(([color, label]) => (
                                <button
                                    key={color}
                                    className={`color-btn ${selectedColor === color ? 'color-btn-active' : ''}`}
                                    onClick={() => setSelectedColor(color)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handlePoopSave}
                        disabled={poopSaving}
                    >
                        {poopSaving ? '记录中...' : '保存记录'}
                    </Button>
                </div>
            </Modal>

            {/* ── Feed Modal ── */}
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
                                {mealLabels[meal]}
                            </button>
                        ))}
                    </div>

                    {todayFeeds.length > 0 && (
                        <div className="feed-history">
                            <label className="form-label">今日记录</label>
                            {todayFeeds.map((f) => (
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
                        disabled={feedLoading}
                    >
                        {feedLoading ? '记录中...' : '确认喂食 🐾'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
