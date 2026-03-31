import { useState, useEffect, useCallback, useMemo, useRef, useOptimistic, useTransition } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'
import { RenewModal } from '../components/ui/RenewModal'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useRealtimeSubscription } from '../lib/realtime'
import { useCat } from '../lib/useCat'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useRenewForm } from '../lib/useRenewForm'
import { useToastStore } from '../stores/useToastStore'
import { reloadCatData } from '../stores/useCatStore'
import { getErrorMessage } from '../lib/errorMessage'
import { lightHaptic } from '../lib/haptics'
import { sendReminderPush, sendScoopNotification, sendFeedNotification, sendAbnormalPoopNotification, sendMissNotification } from '../lib/pushServer'
import { useFamily } from '../lib/useFamily'
import { BRISTOL_LABELS, POOP_COLOR_LABELS, MEAL_LABELS, isAbnormalPoop } from '../lib/constants'
import { differenceInDays, format, startOfMonth, endOfMonth, eachDayOfInterval, getDate } from 'date-fns'
import type { MoodType, BristolType, PoopColor, DiaryEntry, InventoryItem, FeedStatus, HealthRecord } from '../types/database.types'
import { computeInventoryStatus } from '../types/database.types'
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
    const { cat, catId, cats, setCatId, families, activeFamilyId, loading: catLoading } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const [searchParams, setSearchParams] = useSearchParams()
    const online = useOnlineStatus()

    const [todayFeeds, setTodayFeeds] = useState<FeedStatus[]>([])
    const [optimisticFeeds, addOptimisticFeed] = useOptimistic(
        todayFeeds,
        (current, newFeed: FeedStatus) => [newFeed, ...current],
    )

    // Feed modal
    const [feedModalOpen, setFeedModalOpen] = useState(false)
    const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast')
    const [todayMood, setTodayMood] = useState<MoodType | null>(null)
    const [optimisticMood, setOptimisticMood] = useOptimistic(todayMood)
    const [, startTransition] = useTransition()
    const [moodEditing, setMoodEditing] = useState(false)
    const [monthMoodMap, setMonthMoodMap] = useState<Record<string, MoodType>>({})
    const [latestDiary, setLatestDiary] = useState<DiaryEntry | null>(null)
    const [latestDiaryExpanded, setLatestDiaryExpanded] = useState(false)
    const DIARY_SNIPPET_LIMIT = 100
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [healthReminders, setHealthReminders] = useState<HealthRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false)

    // Renew modal (vaccine / deworming) — shared hook
    // Use arrow wrapper to avoid forward-reference of loadData
    const renew = useRenewForm({ catId, onSuccess: () => loadData() })

    const [weekFeedCount, setWeekFeedCount] = useState(0)
    const [weekMoodCounts, setWeekMoodCounts] = useState<Record<string, number>>({ '😸': 0, '😾': 0, '😴': 0 })
    const [weekAbnormalPoopCount, setWeekAbnormalPoopCount] = useState(0)
    const [weekWeightDelta, setWeekWeightDelta] = useState<number | null>(null)

    const [onboardingName, setOnboardingName] = useState('')
    const [onboardingBreed, setOnboardingBreed] = useState('')
    const [onboardingBirthday, setOnboardingBirthday] = useState('')
    const [onboardingAdoptedAt, setOnboardingAdoptedAt] = useState('')
    const [onboardingSaving, setOnboardingSaving] = useState(false)

    // Family onboarding
    const [obFamilyName, setObFamilyName] = useState('')
    const [obJoinCode, setObJoinCode] = useState('')
    const { createFamily, joinFamily, familySaving: obFamilySaving } = useFamily()

    // Poop modal
    const [poopModalOpen, setPoopModalOpen] = useState(false)
    const [selectedBristol, setSelectedBristol] = useState<BristolType>('4')
    const [selectedColor, setSelectedColor] = useState<PoopColor>('brown')
    const [poopSaving, setPoopSaving] = useState(false)
    const [missSaving, setMissSaving] = useState(false)

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

        try {
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
                    .in('type', ['vaccine', 'deworming'])
                    .not('next_due', 'is', null)
                    .order('next_due', { ascending: true }),
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
                setHealthReminders(healthRes.data)
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
                const abnormal = weekPoopsRes.data.filter((item) => isAbnormalPoop(item.bristol_type, item.color))
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
        } catch (err) {
            console.error('Failed to load dashboard data:', err)
            pushToast('error', getErrorMessage(err, '数据加载失败，请稍后重试'))
        } finally {
            setLoading(false)
        }
    }, [catId, catLoading, monthEnd, monthStart, today, pushToast])

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
    const { daysHome, daysToBirthday } = useMemo(() => {
        if (!cat) return { daysHome: null, daysToBirthday: null }

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

        return { daysHome, daysToBirthday }
    }, [cat])

    // ─── Health reminders (memoized) ──────────────
    const healthReminderItems = useMemo(() => {
        const now = new Date()
        return healthReminders.map((r) => {
            const daysLeft = differenceInDays(new Date(r.next_due!), now)
            return { ...r, daysLeft }
        })
    }, [healthReminders])

    // ─── Feed record ─────────────────────────────
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

        startTransition(async () => {
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
                await loadData()
                lightHaptic()
                triggerRewardBurst('🐾')
                pushToast('success', '喂食记录成功 🐾')
                sendFeedNotification(cat.id, cat.name, MEAL_LABELS[selectedMeal]).catch(() => { })
            } catch (err) {
                pushToast('error', getErrorMessage(err, '喂食记录失败，请稍后重试'))
            } finally {
                setFeedLoading(false)
            }
        })
    }

    // ─── Mood picker ──────────────────────────────
    const handleMoodPick = async (mood: MoodType) => {
        if (!cat || !user || moodSaving) return
        setMoodSaving(true)

        startTransition(async () => {
            setOptimisticMood(mood)
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
        })
    }

    // ─── Poop log ─────────────────────────────────
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
            if (selectedBristol === '4') {
                triggerRewardBurst('💖')
            }
            pushToast('success', '铲屎记录成功 💩')
            sendScoopNotification(cat.id, cat.name).catch(() => {
                pushToast('info', '铲屎记录已保存，但家庭通知发送失败')
            })
            if (isAbnormalPoop(selectedBristol, selectedColor)) {
                sendAbnormalPoopNotification(cat.id, cat.name, selectedBristol, selectedColor).catch(() => { })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '铲屎记录失败，请稍后重试'))
        } finally {
            setPoopSaving(false)
        }
    }

    const moodColorMap: Record<MoodType, string> = {
        '😸': 'mood-day-happy',
        '😾': 'mood-day-angry',
        '😴': 'mood-day-sleepy',
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
            sendMissNotification(cat.id, cat.name).catch(() => { })
        } catch (err) {
            pushToast('error', getErrorMessage(err, '记录失败，请稍后重试'))
        } finally {
            setMissSaving(false)
        }
    }

    // ─── Inventory alerts ─────────────────────────
    const lowInventory = useMemo(() => inventory.filter((i) => computeInventoryStatus(i) !== 'plenty'), [inventory])

    const urgentHealthReminders = useMemo(() => healthReminderItems.filter((r) => r.daysLeft <= 7), [healthReminderItems])

    useEffect(() => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

        const todayKey = new Date().toISOString().split('T')[0]

        if (lowInventory.some((item) => computeInventoryStatus(item) === 'urgent')) {
            const key = `notify_inventory_${todayKey}`
            if (!localStorage.getItem(key)) {
                new Notification('库存提醒', {
                    body: '有物资已到紧急状态，记得补货。',
                })
                localStorage.setItem(key, '1')
            }
        }

        for (const r of urgentHealthReminders) {
            const typeLabel = r.type === 'vaccine' ? '疫苗' : '驱虫'
            const key = `notify_health_${r.id}_${todayKey}`
            if (!localStorage.getItem(key)) {
                const body = r.daysLeft <= 0
                    ? `「${r.name}」${typeLabel}已过期，请尽快处理。`
                    : `「${r.name}」${typeLabel}将在 ${r.daysLeft} 天后到期。`
                new Notification(`${typeLabel}提醒`, { body })
                localStorage.setItem(key, '1')
            }
        }
    }, [urgentHealthReminders, lowInventory])

    useEffect(() => {
        const hasLowOrUrgentInventory = lowInventory.length > 0
        const hasHealthReminder = urgentHealthReminders.length > 0
        if (!hasLowOrUrgentInventory && !hasHealthReminder) return

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
    }, [catId, urgentHealthReminders, lowInventory])

    const handleObCreateFamily = async () => {
        await createFamily(obFamilyName, {
            onSuccess: () => setObFamilyName(''),
        })
    }

    const handleObJoinFamily = async () => {
        await joinFamily(obJoinCode, {
            onSuccess: () => setObJoinCode(''),
        })
    }

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
                    family_id: activeFamilyId,
                    created_by: user.id,
                })
                .select()
                .single()
            if (error) throw error
            if (data) {
                setCatId(data.id)
                reloadCatData()
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
        const currentIndex = options.findIndex((item) => item === (optimisticMood || '😸'))
        const nextIndex = (currentIndex + direction + options.length) % options.length
        void handleMoodPick(options[nextIndex])
    }

    if (loading || catLoading) {
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

    if (families.length === 0) {
        return (
            <div className="dashboard fade-in onboarding-page">
                <Card variant="accent" padding="lg" className="onboarding-card">
                    <h1 className="text-2xl font-bold">欢迎来到喵记！</h1>
                    <p className="text-sm text-secondary">首先创建或加入一个家庭</p>
                    <div className="onboarding-form">
                        <label className="form-label" htmlFor="ob-family-name">创建家庭</label>
                        <input
                            id="ob-family-name"
                            className="form-input"
                            placeholder="输入家庭名称"
                            value={obFamilyName}
                            onChange={(e) => setObFamilyName(e.target.value)}
                        />
                        <Button variant="primary" fullWidth onClick={handleObCreateFamily} disabled={obFamilySaving || !online}>
                            {obFamilySaving ? '创建中...' : '创建家庭'}
                        </Button>
                        <div className="onboarding-divider">
                            <span>或者</span>
                        </div>
                        <label className="form-label" htmlFor="ob-join-code">加入家庭</label>
                        <input
                            id="ob-join-code"
                            className="form-input"
                            placeholder="输入邀请码"
                            value={obJoinCode}
                            onChange={(e) => setObJoinCode(e.target.value.toUpperCase())}
                        />
                        <Button variant="secondary" fullWidth onClick={handleObJoinFamily} disabled={obFamilySaving || !online}>
                            {obFamilySaving ? '加入中...' : '加入家庭'}
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    if (cats.length === 0) {
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
            <div className="stagger-item">
            <Card variant="accent" padding="lg" className="cat-profile-card">
                <div className="profile-header">
                    <div className="avatar-placeholder">
                        {cat?.avatar_url ? (
                            <button
                                type="button"
                                className="avatar-preview-btn"
                                onClick={() => setAvatarPreviewOpen(true)}
                                aria-label="查看猫咪头像大图"
                            >
                                <img src={cat.avatar_url} alt={cat.name} className="avatar-img" loading="lazy" />
                            </button>
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
                </div>
            </Card>
            </div>

            <Modal isOpen={avatarPreviewOpen} onClose={() => setAvatarPreviewOpen(false)} title={cat?.name ? `${cat.name} 的头像` : '猫咪头像'}>
                {cat?.avatar_url ? (
                    <img src={cat.avatar_url} alt={cat.name || '猫咪头像'} className="avatar-preview-modal-img" loading="lazy" />
                ) : null}
            </Modal>

            {/* ── Health Reminders ── */}
            {urgentHealthReminders.length > 0 && (
                <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                    <Card variant="default" padding="md">
                        <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>🩺 疫苗 / 驱虫提醒</h2>
                        <div className="health-reminder-list">
                            {urgentHealthReminders.map((r) => {
                                const isPastDue = r.daysLeft <= 0
                                const isUrgent = r.daysLeft <= 7
                                const icon = r.type === 'vaccine' ? '💉' : '💊'
                                const typeLabel = r.type === 'vaccine' ? '疫苗' : '驱虫'
                                return (
                                    <div key={r.id} className={`health-reminder-item ${isPastDue ? 'health-reminder-overdue' : isUrgent ? 'health-reminder-urgent' : ''}`}>
                                        <span className="health-reminder-icon">{icon}</span>
                                        <div className="health-reminder-info">
                                            <span className="text-sm font-semibold">{r.name}</span>
                                            <span className="text-xs text-muted">{typeLabel} · 到期：{format(new Date(r.next_due!), 'yyyy/MM/dd')}</span>
                                        </div>
                                        <span className={`health-reminder-days ${isPastDue ? 'text-danger' : isUrgent ? 'text-warning' : 'text-secondary'}`}>
                                            {isPastDue ? `过期${Math.abs(r.daysLeft)}天` : `${r.daysLeft}天`}
                                        </span>
                                        {isPastDue && (
                                            <button
                                                type="button"
                                                className="health-renew-btn"
                                                onClick={() => renew.openRenewModal(r)}
                                            >
                                                🔄 续期
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </Card>
                </div>
            )}

            {/* ── Quick Action Buttons ── */}
            <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                <div className="quick-action-row">
                    <button
                        className="quick-scoop-btn"
                        onClick={() => {
                            lightHaptic()
                            setPoopModalOpen(true)
                        }}
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

            {/* ── Inventory Alert Banner ── */}
            {lowInventory.length > 0 && (
                <div className="inventory-alert mx-4">
                    🛒 {lowInventory.map((i) => `${i.item_name}${computeInventoryStatus(i) === 'urgent' ? '🔴' : '🟡'}`).join('、')} — 记得补货！
                </div>
            )}

            <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                <Card variant="glass" padding="md" aria-label="记录心情">
                    <div className="mood-head-row">
                        <div className="bento-label">今日心情</div>
                        <div className="mood-status-row">
                            <span className="text-sm text-secondary">
                                {optimisticMood ? `已记录：${optimisticMood}` : '未记录'}
                            </span>
                            {optimisticMood && !moodEditing && (
                                <button type="button" className="mood-edit-btn" onClick={() => setMoodEditing(true)}>
                                    修改
                                </button>
                            )}
                        </div>
                    </div>
                    {(!optimisticMood || moodEditing) && (
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
                                    className={`mood-btn ${optimisticMood === mood ? 'mood-btn-active' : ''}`}
                                    onClick={() => handleMoodPick(mood)}
                                    disabled={moodSaving || !online}
                                    aria-label={mood}
                                    role="radio"
                                    aria-checked={optimisticMood === mood}
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
            <div className="section-header px-4 stagger-item">
                <h2 className="text-lg font-semibold">最近动态</h2>
            </div>
            <div className="px-4 stagger-item">
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

            <div className="px-4 stagger-item" style={{ marginTop: 'var(--space-3)' }}>
                <Card variant="default" padding="md">
                    {latestDiary ? (() => {
                        const fullText = latestDiary.text || '(无文字)'
                        const isLong = fullText.length > DIARY_SNIPPET_LIMIT
                        const displayText = isLong && !latestDiaryExpanded ? fullText.slice(0, DIARY_SNIPPET_LIMIT) + '...' : fullText
                        return (
                            <div className="diary-snippet">
                                {latestDiary.image_url && (
                                    <img src={latestDiary.image_url} alt="" className="diary-img" loading="lazy" />
                                )}
                                <p className="text-sm diary-snippet-text">{displayText}</p>
                                {isLong && (
                                    <button
                                        className="diary-expand-btn"
                                        onClick={() => setLatestDiaryExpanded(!latestDiaryExpanded)}
                                    >
                                        {latestDiaryExpanded ? '收起 ▲' : '展开全文 ▼'}
                                    </button>
                                )}
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
                        )
                    })() : (
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
                            onChange={(event) => setSelectedBristol(event.target.value as BristolType)}
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

            {/* ── Renew Modal ── */}
            <RenewModal
                isOpen={renew.renewModalOpen}
                onClose={renew.closeRenewModal}
                record={renew.renewRecord}
                renewDate={renew.renewDate}
                onRenewDateChange={renew.setRenewDate}
                renewNextDue={renew.renewNextDue}
                onRenewNextDueChange={renew.setRenewNextDue}
                renewNotes={renew.renewNotes}
                onRenewNotesChange={renew.setRenewNotes}
                saving={renew.renewSaving}
                onSave={renew.handleRenewSave}
                online={online}
                idSuffix="-dash"
            />
        </div>
    )
}
