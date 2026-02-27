import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useRealtimeSubscription } from '../lib/realtime'
import { useCat } from '../lib/useCat'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { lightHaptic } from '../lib/haptics'
import { sendReminderPush } from '../lib/pushServer'
import { differenceInDays, format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDate } from 'date-fns'
import type { MoodType, BristolType, PoopColor, DiaryEntry, InventoryItem, FeedStatus } from '../types/database.types'
import './DashboardPage.css'

type RewardParticle = {
    id: number
    icon: '💖' | '🐾'
    dx: number
    dy: number
    delayMs: number
}

export function DashboardPage() {
    const { user } = useSession()
    const { cat, catId, cats, setCatId, loading: catLoading } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const [searchParams, setSearchParams] = useSearchParams()
    const online = useOnlineStatus()

    const [todayFeeds, setTodayFeeds] = useState<FeedStatus[]>([])

    // Feed modal
    const [feedModalOpen, setFeedModalOpen] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
    const [todayMood, setTodayMood] = useState<MoodType | null>(null)
    const [moodEditing, setMoodEditing] = useState(false)
    const [monthMoodMap, setMonthMoodMap] = useState<Record<string, MoodType>>({})
    const [latestDiary, setLatestDiary] = useState<DiaryEntry | null>(null)
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [nextDeworming, setNextDeworming] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const [weekFeedCount, setWeekFeedCount] = useState(0)
    const [weekMoodCounts, setWeekMoodCounts] = useState<Record<string, number>>({ '😸': 0, '😾': 0, '😴': 0 })
    const [weekAbnormalPoopCount, setWeekAbnormalPoopCount] = useState(0)
    const [weekWeightDelta, setWeekWeightDelta] = useState<number | null>(null)

    const [onboardingName, setOnboardingName] = useState('')
    const [onboardingBreed, setOnboardingBreed] = useState('')
    const [onboardingBirthday, setOnboardingBirthday] = useState('')
    const [onboardingAdoptedAt, setOnboardingAdoptedAt] = useState('')
    const [onboardingSaving, setOnboardingSaving] = useState(false)

    // Poop modal
    const [poopModalOpen, setPoopModalOpen] = useState(false)
    const [selectedBristol, setSelectedBristol] = useState<BristolType>(4)
    const [selectedColor, setSelectedColor] = useState<PoopColor>('brown')
    const [poopSaving, setPoopSaving] = useState(false)

    const [feedLoading, setFeedLoading] = useState(false)
    const [moodSaving, setMoodSaving] = useState(false)
    const [rewardEmoji, setRewardEmoji] = useState<'💖' | '🐾' | null>(null)
    const [rewardParticles, setRewardParticles] = useState<RewardParticle[]>([])

    const particleIdRef = useRef(1)

    const [today, setToday] = useState(() => new Date().toISOString().split('T')[0])
    const monthStart = useMemo(() => startOfMonth(new Date(today)), [today])
    const monthEnd = useMemo(() => endOfMonth(new Date(today)), [today])
    const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthEnd, monthStart])

    const pickDefaultMeal = useCallback(() => {
        const hour = new Date().getHours()
        if (hour >= 5 && hour <= 10) return 'breakfast' as const
        if (hour >= 11 && hour <= 14) return 'lunch' as const
        if (hour >= 20) return 'snack' as const
        return 'dinner' as const
    }, [])

    const triggerRewardBurst = (icon: '💖' | '🐾') => {
        setRewardEmoji(icon)
        window.setTimeout(() => setRewardEmoji(null), 1000)

        const particles: RewardParticle[] = Array.from({ length: 8 }).map(() => {
            const id = particleIdRef.current++
            return {
                id,
                icon,
                dx: Math.round((Math.random() - 0.5) * 120),
                dy: -Math.round(36 + Math.random() * 90),
                delayMs: Math.round(Math.random() * 140),
            }
        })

        setRewardParticles((prev) => [...prev, ...particles])
        window.setTimeout(() => {
            const idSet = new Set(particles.map((p) => p.id))
            setRewardParticles((prev) => prev.filter((p) => !idSet.has(p.id)))
        }, 1200)
    }

    // ─── Load all data (parallel) ─────────────────
    const loadData = useCallback(async () => {
        if (!catId) {
            if (!catLoading) {
                setLoading(false)
            }
            return
        }

        setLoading(true)
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - 6)
        const weekStartIso = `${format(weekStart, 'yyyy-MM-dd')}T00:00:00`

        const [feedRes, moodRes, diaryRes, invRes, healthRes, weekFeedsRes, weekMoodsRes, weekPoopsRes, weekWeightsRes, monthMoodsRes] = await Promise.all([
            supabase
                .from('feed_status')
                .select('*')
                .eq('cat_id', catId)
                .gte('updated_at', `${today}T00:00:00`)
                .order('fed_at', { ascending: false }),
            supabase
                .from('mood_logs')
                .select('*')
                .eq('cat_id', catId)
                .eq('date', today)
                .limit(1)
                .single(),
            supabase
                .from('diary_entries')
                .select('*')
                .eq('cat_id', catId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
            supabase
                .from('inventory')
                .select('*')
                .eq('cat_id', catId),
            supabase
                .from('health_records')
                .select('*')
                .eq('cat_id', catId)
                .eq('type', 'deworming')
                .order('date', { ascending: false })
                .limit(1)
                .single(),
            supabase
                .from('feed_status')
                .select('*')
                .eq('cat_id', catId)
                .gte('updated_at', weekStartIso),
            supabase
                .from('mood_logs')
                .select('*')
                .eq('cat_id', catId)
                .gte('created_at', weekStartIso),
            supabase
                .from('poop_logs')
                .select('*')
                .eq('cat_id', catId)
                .gte('created_at', weekStartIso),
            supabase
                .from('weight_records')
                .select('*')
                .eq('cat_id', catId)
                .gte('recorded_at', weekStartIso)
                .order('recorded_at', { ascending: true }),
            supabase
                .from('mood_logs')
                .select('*')
                .eq('cat_id', catId)
                .gte('date', format(monthStart, 'yyyy-MM-dd'))
                .lte('date', format(monthEnd, 'yyyy-MM-dd')),
        ])

        if (feedRes.data) setTodayFeeds(feedRes.data)
        if (moodRes.data) setTodayMood(moodRes.data.mood)
        if (diaryRes.data) setLatestDiary(diaryRes.data)
        if (invRes.data) setInventory(invRes.data)
        if (healthRes.data) {
            const nextDue = healthRes.data.next_due || format(addMonths(new Date(healthRes.data.date), 3), 'yyyy-MM-dd')
            setNextDeworming(nextDue)
        }

        if (weekFeedsRes.data) {
            setWeekFeedCount(weekFeedsRes.data.length)
        }

        if (weekMoodsRes.data) {
            const counts = { '😸': 0, '😾': 0, '😴': 0 }
            weekMoodsRes.data.forEach((item) => {
                counts[item.mood] += 1
            })
            setWeekMoodCounts(counts)
        }

        if (weekPoopsRes.data) {
            const abnormal = weekPoopsRes.data.filter((item) => Number(item.bristol_type) >= 6 || ['red', 'black', 'white'].includes(item.color))
            setWeekAbnormalPoopCount(abnormal.length)
        }

        if (weekWeightsRes.data && weekWeightsRes.data.length >= 2) {
            const first = weekWeightsRes.data[0].weight_kg
            const last = weekWeightsRes.data[weekWeightsRes.data.length - 1].weight_kg
            setWeekWeightDelta(Number((last - first).toFixed(2)))
        } else {
            setWeekWeightDelta(null)
        }

        if (monthMoodsRes.data) {
            const map: Record<string, MoodType> = {}
            monthMoodsRes.data.forEach((entry) => {
                map[entry.date] = entry.mood
            })
            setMonthMoodMap(map)
        }
        setLoading(false)
    }, [catId, catLoading, monthEnd, monthStart, today])

    useEffect(() => {
        loadData()
    }, [loadData])

    useEffect(() => {
        const now = new Date()
        const next = new Date(now)
        next.setHours(24, 0, 2, 0)
        const timer = window.setTimeout(() => {
            setToday(new Date().toISOString().split('T')[0])
        }, next.getTime() - now.getTime())

        return () => window.clearTimeout(timer)
    }, [today])

    useEffect(() => {
        const quick = searchParams.get('quick')
        if (!quick) return

        if (quick === 'feed') {
            setSelectedMeal(pickDefaultMeal())
            setFeedModalOpen(true)
        }
        if (quick === 'poop') {
            setPoopModalOpen(true)
        }

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('quick')
            return next
        }, { replace: true })
    }, [pickDefaultMeal, searchParams, setSearchParams])

    // ─── Realtime subscriptions ───────────────────
    useRealtimeSubscription('feed_status', () => {
        loadData()
    }, catId ? `cat_id=eq.${catId}` : undefined)

    useRealtimeSubscription('mood_logs', () => {
        loadData()
    }, catId ? `cat_id=eq.${catId}` : undefined)

    // ─── Countdown calculations (memoized) ────────
    const { daysHome, daysToBirthday, daysToDeworming } = useMemo(() => {
        if (!cat) return { daysHome: null, daysToBirthday: null, daysToDeworming: null }

        const now = new Date()

        let daysHome: number | null = null
        if (cat.adopted_at) {
            daysHome = differenceInDays(now, new Date(cat.adopted_at))
        }

        let daysToBirthday: number | null = null
        if (cat.birthday) {
            const bday = new Date(cat.birthday)
            const nextBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
            if (nextBday < now) nextBday.setFullYear(nextBday.getFullYear() + 1)
            daysToBirthday = differenceInDays(nextBday, now)
        }

        let daysToDeworming: number | null = null
        if (nextDeworming) {
            daysToDeworming = differenceInDays(new Date(nextDeworming), now)
        }

        return { daysHome, daysToBirthday, daysToDeworming }
    }, [cat, nextDeworming])

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
            lightHaptic()
            triggerRewardBurst('🐾')
            pushToast('success', '喂食记录成功 🐾')
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
            setMoodEditing(false)
            lightHaptic()
            pushToast('success', '心情已记录')
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
            lightHaptic()
            if (selectedBristol === 4) {
                triggerRewardBurst('💖')
            }
            pushToast('success', '铲屎记录成功 💩')
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

    const moodColorMap: Record<MoodType, string> = {
        '😸': 'mood-day-happy',
        '😾': 'mood-day-angry',
        '😴': 'mood-day-sleepy',
    }

    // ─── Inventory alerts ─────────────────────────
    const lowInventory = inventory.filter((i) => i.status !== 'plenty')

    useEffect(() => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

        const todayKey = new Date().toISOString().split('T')[0]

        if (lowInventory.some((item) => item.status === 'urgent')) {
            const key = `notify_inventory_${todayKey}`
            if (!localStorage.getItem(key)) {
                new Notification('喵记库存提醒', {
                    body: '有物资已到紧急状态，记得补货。',
                })
                localStorage.setItem(key, '1')
            }
        }

        if (daysToDeworming !== null && daysToDeworming <= 1) {
            const key = `notify_deworming_${todayKey}`
            if (!localStorage.getItem(key)) {
                new Notification('喵记驱虫提醒', {
                    body: daysToDeworming <= 0 ? '今天建议进行驱虫。' : '明天建议进行驱虫。',
                })
                localStorage.setItem(key, '1')
            }
        }
    }, [daysToDeworming, lowInventory])

    useEffect(() => {
        const hasUrgentInventory = lowInventory.some((item) => item.status === 'urgent')
        const hasDewormingReminder = daysToDeworming !== null && daysToDeworming <= 1
        if (!hasUrgentInventory && !hasDewormingReminder) return

        const todayKey = new Date().toISOString().split('T')[0]
        const serverKey = `server_push_reminder_${todayKey}_${catId || 'none'}`
        if (localStorage.getItem(serverKey)) return

        sendReminderPush(catId || undefined)
            .then(() => {
                localStorage.setItem(serverKey, '1')
            })
            .catch(() => {
                // no-op: frontend local notification fallback already exists
            })
    }, [catId, daysToDeworming, lowInventory])

    const handleOnboardingSave = async () => {
        if (!user || !onboardingName.trim()) {
            pushToast('error', '请先填写猫咪名字')
            return
        }
        setOnboardingSaving(true)
        try {
            const { data, error } = await supabase
                .from('cats')
                .insert({
                    name: onboardingName.trim(),
                    breed: onboardingBreed.trim() || null,
                    birthday: onboardingBirthday || null,
                    adopted_at: onboardingAdoptedAt || null,
                    avatar_url: null,
                    created_by: user.id,
                })
                .select()
                .single()
            if (error) throw error
            if (data) {
                setCatId(data.id)
                pushToast('success', '欢迎加入喵记！🐱')
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '创建猫咪档案失败，请稍后重试'))
        } finally {
            setOnboardingSaving(false)
        }
    }

    const moveMoodSelection = (direction: 1 | -1) => {
        const options: MoodType[] = ['😸', '😾', '😴']
        const currentIndex = options.findIndex((item) => item === (todayMood || '😸'))
        const nextIndex = (currentIndex + direction + options.length) % options.length
        void handleMoodPick(options[nextIndex])
    }

    if (!loading && !catLoading && cats.length === 0) {
        return (
            <div className="dashboard fade-in onboarding-page">
                <Card variant="accent" padding="lg" className="onboarding-card">
                    <h1 className="text-2xl font-bold">欢迎来到喵记！</h1>
                    <p className="text-sm text-secondary">先来建立猫咪档案吧（可在设置页继续补充）</p>
                    <div className="onboarding-form">
                        <label className="form-label" htmlFor="onboarding-name">猫咪名字 *</label>
                        <input
                            id="onboarding-name"
                            className="form-input"
                            placeholder="咪名"
                            value={onboardingName}
                            onChange={(event) => setOnboardingName(event.target.value)}
                        />
                        <label className="form-label" htmlFor="onboarding-breed">品种 / 花色（可选）</label>
                        <input
                            id="onboarding-breed"
                            className="form-input"
                            placeholder="咪族"
                            value={onboardingBreed}
                            onChange={(event) => setOnboardingBreed(event.target.value)}
                        />
                        <label className="form-label" htmlFor="onboarding-birthday">生日（可选）</label>
                        <input
                            id="onboarding-birthday"
                            className="form-input"
                            type="date"
                            value={onboardingBirthday}
                            onChange={(event) => setOnboardingBirthday(event.target.value)}
                        />
                        <label className="form-label" htmlFor="onboarding-adopted">领养日（可选）</label>
                        <input
                            id="onboarding-adopted"
                            className="form-input"
                            type="date"
                            value={onboardingAdoptedAt}
                            onChange={(event) => setOnboardingAdoptedAt(event.target.value)}
                        />
                        <Button variant="primary" fullWidth onClick={handleOnboardingSave} disabled={onboardingSaving || !online}>
                            {onboardingSaving ? '创建中...' : '完成并进入首页'}
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="cat-profile-card">
                    <Skeleton height="180px" borderRadius="var(--radius-xl)" />
                </div>
                <div className="bento-grid">
                    <Skeleton height="120px" borderRadius="var(--radius-lg)" />
                    <Skeleton height="120px" borderRadius="var(--radius-lg)" />
                    <Skeleton height="120px" borderRadius="var(--radius-lg)" className="span-2" />
                </div>
                <div className="px-4">
                    <Skeleton height="180px" borderRadius="var(--radius-lg)" />
                </div>
            </div>
        )
    }

    return (
        <div className="dashboard fade-in">
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

            <div className="px-4" style={{ marginBottom: 'var(--space-3)' }}>
                <Card variant="glass" padding="md" aria-label="记录心情">
                    <div className="mood-head-row">
                        <div className="bento-label">今日心情</div>
                        <div className="mood-status-row">
                            <span className="text-sm text-secondary">
                                {todayMood ? `已记录：${todayMood}` : '未记录'}
                            </span>
                            {todayMood && !moodEditing && (
                                <button type="button" className="mood-edit-btn" onClick={() => setMoodEditing(true)}>
                                    修改
                                </button>
                            )}
                        </div>
                    </div>
                    {(!todayMood || moodEditing) && (
                        <div
                            className="mood-picker"
                            role="radiogroup"
                            aria-label="心情选择"
                            onKeyDown={(event) => {
                                if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                                    event.preventDefault()
                                    moveMoodSelection(1)
                                }
                                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                                    event.preventDefault()
                                    moveMoodSelection(-1)
                                }
                            }}
                        >
                            {(['😸', '😾', '😴'] as MoodType[]).map((mood) => (
                                <button
                                    key={mood}
                                    className={`mood-btn ${todayMood === mood ? 'mood-btn-active' : ''}`}
                                    onClick={() => handleMoodPick(mood)}
                                    disabled={moodSaving || !online}
                                    aria-label={mood}
                                    role="radio"
                                    aria-checked={todayMood === mood}
                                >
                                    {mood}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="mood-calendar">
                        {monthDays.map((day) => {
                            const key = format(day, 'yyyy-MM-dd')
                            const mood = monthMoodMap[key]
                            return (
                                <div
                                    key={key}
                                    className={`mood-day ${mood ? moodColorMap[mood] : ''}`}
                                    title={`${format(day, 'MM/dd')} ${mood || '无记录'}`}
                                >
                                    {getDate(day)}
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>

            {/* ── Latest Diary ── */}
            <div className="section-header px-4">
                <h2 className="text-lg font-semibold">最近动态</h2>
            </div>
            <div className="px-4">
                <Card variant="default" padding="md">
                    <div className="section-row">
                        <h2 className="text-lg font-semibold">📊 本周总结</h2>
                    </div>
                    <div className="week-summary-grid">
                        <div className="week-item">
                            <span className="text-sm text-secondary">喂食次数</span>
                            <strong>{weekFeedCount} 次</strong>
                        </div>
                        <div className="week-item">
                            <span className="text-sm text-secondary">心情分布</span>
                            <strong>😸{weekMoodCounts['😸']} / 😾{weekMoodCounts['😾']} / 😴{weekMoodCounts['😴']}</strong>
                        </div>
                        <div className="week-item">
                            <span className="text-sm text-secondary">异常便便</span>
                            <strong>{weekAbnormalPoopCount} 次</strong>
                        </div>
                        <div className="week-item">
                            <span className="text-sm text-secondary">体重变化</span>
                            <strong>{weekWeightDelta === null ? '暂无数据' : `${weekWeightDelta > 0 ? '+' : ''}${weekWeightDelta} kg`}</strong>
                        </div>
                    </div>
                </Card>
            </div>

            <div className="px-4" style={{ marginTop: 'var(--space-3)' }}>
                <Card variant="default" padding="md">
                    {latestDiary ? (
                        <div className="diary-snippet">
                            {latestDiary.image_url && (
                                <img src={latestDiary.image_url} alt="" className="diary-img" />
                            )}
                            <p className="text-sm diary-snippet-text">{latestDiary.text || '(无文字)'}</p>
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
                        <select
                            className="form-input"
                            aria-label="布里斯托类型选择"
                            value={selectedBristol}
                            onChange={(event) => setSelectedBristol(Number(event.target.value) as BristolType)}
                        >
                            {([1, 2, 3, 4, 5, 6, 7] as BristolType[]).map((type) => (
                                <option key={type} value={type}>
                                    类型 {type} · {bristolLabels[type]}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-section">
                        <label className="form-label">颜色</label>
                        <div className="color-grid compact" role="radiogroup" aria-label="便便颜色选择">
                            {(Object.entries(colorLabels) as [PoopColor, string][]).map(([color, label]) => (
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

                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handlePoopSave}
                        disabled={poopSaving || !online}
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
                        disabled={feedLoading || !online}
                    >
                        {feedLoading ? '记录中...' : '确认喂食 🐾'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
