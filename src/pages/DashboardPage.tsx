import { useState, useEffect } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useRenewForm } from '../lib/useRenewForm'
import { useToastStore } from '../stores/useToastStore'
import { reloadCatData } from '../stores/useCatStore'
import { getErrorMessage } from '../lib/errorMessage'
import { sendReminderPush } from '../lib/pushServer'
import { useFamily } from '../lib/useFamily'
import { format } from 'date-fns'
import { useDashboardData } from '../hooks/useDashboardData'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { CatProfileCard, WeeklySummaryCard, MoodCalendarSection, HealthReminders, ExpiryReminders, QuickActions } from '../components/dashboard'
import { computeInventoryStatus } from '../types/database.types'
import { STORAGE_KEYS } from '../lib/constants'
import './DashboardPage.css'

const DIARY_SNIPPET_LIMIT = 100

export function DashboardPage() {
    const { user } = useSession()
    const { cat, catId, cats, setCatId, families, activeFamilyId, loading: catLoading } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()

    // ─── Centralized data hook ────────────────────
    const dashboard = useDashboardData(catId, catLoading)
    const { data, loading, today, monthDays, lowInventory, overdueInventoryExpiryReminders, urgentHealthReminders, reload } = dashboard

    // ─── Pull-to-refresh ──────────────────────────
    const pullToRefresh = usePullToRefresh({ onRefresh: reload, enabled: !loading })

    // Renew modal (vaccine / deworming)
    const renew = useRenewForm({ catId, onSuccess: () => reload() })

    const [latestDiaryExpanded, setLatestDiaryExpanded] = useState(false)
    const [discardingExpiryId, setDiscardingExpiryId] = useState<string | null>(null)

    // Onboarding state
    const [onboardingName, setOnboardingName] = useState('')
    const [onboardingBreed, setOnboardingBreed] = useState('')
    const [onboardingBirthday, setOnboardingBirthday] = useState('')
    const [onboardingAdoptedAt, setOnboardingAdoptedAt] = useState('')
    const [onboardingSaving, setOnboardingSaving] = useState(false)
    const [obFamilyName, setObFamilyName] = useState('')
    const [obJoinCode, setObJoinCode] = useState('')
    const { createFamily, joinFamily, familySaving: obFamilySaving } = useFamily()

    const handleDiscardExpiredReminder = async (reminderId: string) => {
        if (!online || !catId || discardingExpiryId) return
        setDiscardingExpiryId(reminderId)
        try {
            const { error } = await supabase
                .from('inventory_expiry_reminders')
                .update({ discarded_at: new Date().toISOString() })
                .eq('id', reminderId)
            if (error) throw error

            pushToast('success', '已标记为已丢弃')
            await reload()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '处理失败，请稍后重试'))
        } finally {
            setDiscardingExpiryId(null)
        }
    }

    // ─── Local & server push notifications ────────
    useEffect(() => {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
        const todayKey = new Date().toISOString().split('T')[0]

        if (lowInventory.some((item) => computeInventoryStatus(item) === 'urgent')) {
            const key = STORAGE_KEYS.notifyInventory(todayKey)
            if (!localStorage.getItem(key)) {
                new Notification('库存提醒', { body: '有物资已到紧急状态，记得补货。' })
                localStorage.setItem(key, '1')
            }
        }

        for (const r of urgentHealthReminders) {
            const typeLabel = r.type === 'vaccine' ? '疫苗' : '驱虫'
            const key = STORAGE_KEYS.notifyHealth(r.id, todayKey)
            if (!localStorage.getItem(key)) {
                const body = r.daysLeft <= 0
                    ? `「${r.name}」${typeLabel}已过期，请尽快处理。`
                    : `「${r.name}」${typeLabel}将在 ${r.daysLeft} 天后到期。`
                new Notification(`${typeLabel}提醒`, { body })
                localStorage.setItem(key, '1')
            }
        }

        for (const item of overdueInventoryExpiryReminders) {
            const key = STORAGE_KEYS.notifyExpiredInventory(item.id, todayKey)
            if (!localStorage.getItem(key)) {
                new Notification('物品过期提醒', {
                    body: `「${item.item_name}」已过期 ${Math.abs(item.daysLeft)} 天，请尽快处理。`,
                })
                localStorage.setItem(key, '1')
            }
        }
    }, [overdueInventoryExpiryReminders, urgentHealthReminders, lowInventory])

    useEffect(() => {
        if (lowInventory.length === 0 && urgentHealthReminders.length === 0 && overdueInventoryExpiryReminders.length === 0) return
        const todayKey = new Date().toISOString().split('T')[0]
        const serverKey = STORAGE_KEYS.serverPushReminder(todayKey, catId || 'none')
        if (localStorage.getItem(serverKey)) return
        sendReminderPush(catId || undefined)
            .then(() => localStorage.setItem(serverKey, '1'))
            .catch(() => { })
    }, [catId, overdueInventoryExpiryReminders, urgentHealthReminders, lowInventory])

    // ─── Onboarding handlers ──────────────────────
    const handleObCreateFamily = async () => {
        await createFamily(obFamilyName, { onSuccess: () => setObFamilyName('') })
    }

    const handleObJoinFamily = async () => {
        await joinFamily(obJoinCode, { onSuccess: () => setObJoinCode('') })
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

    // ─── Loading state ────────────────────────────
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

    // ─── Family onboarding ────────────────────────
    if (families.length === 0) {
        return (
            <div className="dashboard fade-in onboarding-page">
                <Card variant="accent" padding="lg" className="onboarding-card">
                    <h1 className="text-2xl font-bold">欢迎来到喵记！</h1>
                    <p className="text-sm text-secondary">首先创建或加入一个家庭</p>
                    <div className="onboarding-form">
                        <label className="form-label" htmlFor="ob-family-name">创建家庭</label>
                        <input id="ob-family-name" className="form-input" placeholder="输入家庭名称" value={obFamilyName} onChange={(e) => setObFamilyName(e.target.value)} />
                        <Button variant="primary" fullWidth onClick={handleObCreateFamily} disabled={obFamilySaving || !online}>
                            {obFamilySaving ? '创建中...' : '创建家庭'}
                        </Button>
                        <div className="onboarding-divider"><span>或者</span></div>
                        <label className="form-label" htmlFor="ob-join-code">加入家庭</label>
                        <input id="ob-join-code" className="form-input" placeholder="输入邀请码" value={obJoinCode} onChange={(e) => setObJoinCode(e.target.value.toUpperCase())} />
                        <Button variant="secondary" fullWidth onClick={handleObJoinFamily} disabled={obFamilySaving || !online}>
                            {obFamilySaving ? '加入中...' : '加入家庭'}
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    // ─── Cat onboarding ───────────────────────────
    if (cats.length === 0) {
        return (
            <div className="dashboard fade-in onboarding-page">
                <Card variant="accent" padding="lg" className="onboarding-card">
                    <h1 className="text-2xl font-bold">欢迎来到喵记！</h1>
                    <p className="text-sm text-secondary">先来建立猫咪档案吧（可在设置页继续补充）</p>
                    <div className="onboarding-form">
                        <label className="form-label" htmlFor="onboarding-name">猫咪名字 *</label>
                        <input id="onboarding-name" className="form-input" placeholder="咪名" value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)} />
                        <label className="form-label" htmlFor="onboarding-breed">品种 / 花色（可选）</label>
                        <input id="onboarding-breed" className="form-input" placeholder="咪族" value={onboardingBreed} onChange={(e) => setOnboardingBreed(e.target.value)} />
                        <label className="form-label" htmlFor="onboarding-birthday">生日（可选）</label>
                        <input id="onboarding-birthday" className="form-input" type="date" value={onboardingBirthday} onChange={(e) => setOnboardingBirthday(e.target.value)} />
                        <label className="form-label" htmlFor="onboarding-adopted">领养日（可选）</label>
                        <input id="onboarding-adopted" className="form-input" type="date" value={onboardingAdoptedAt} onChange={(e) => setOnboardingAdoptedAt(e.target.value)} />
                        <Button variant="primary" fullWidth onClick={handleOnboardingSave} disabled={onboardingSaving || !online}>
                            {onboardingSaving ? '创建中...' : '完成并进入首页'}
                        </Button>
                    </div>
                </Card>
            </div>
        )
    }

    // ─── Main dashboard ───────────────────────────
    const latestDiary = data.latestDiary

    return (
        <div
            className="dashboard fade-in"
            ref={pullToRefresh.containerRef}
            {...pullToRefresh.handlers}
        >
            {/* Pull-to-refresh indicator */}
            <div
                className={`pull-indicator ${pullToRefresh.isReady ? 'pull-indicator-ready' : ''} ${pullToRefresh.refreshing ? 'pull-indicator-refreshing' : ''}`}
                style={{ height: pullToRefresh.pullDistance > 0 ? `${pullToRefresh.pullDistance}px` : undefined }}
            >
                <span className="pull-indicator-icon">{pullToRefresh.refreshing ? '⟳' : '↓'}</span>
                <span>{pullToRefresh.refreshing ? '刷新中…' : pullToRefresh.isReady ? '松手刷新' : '下拉刷新'}</span>
            </div>

            <CatProfileCard cat={cat} />

            <HealthReminders
                items={urgentHealthReminders}
                renew={renew}
                online={online}
            />

            <ExpiryReminders
                items={overdueInventoryExpiryReminders}
                online={online}
                discardingId={discardingExpiryId}
                onDiscard={handleDiscardExpiredReminder}
            />

            <QuickActions
                cat={cat}
                todayFeeds={data.todayFeeds}
                lowInventory={lowInventory}
                onDataChange={reload}
            />

            <MoodCalendarSection
                cat={cat}
                today={today}
                todayMood={data.todayMood}
                monthMoodMap={data.monthMoodMap}
                monthDays={monthDays}
                onMoodSaved={(mood) => dashboard.setTodayMood(mood)}
            />

            {/* ── Weekly Summary + Latest Diary ── */}
            <div className="section-header px-4 stagger-item">
                <h2 className="text-lg font-semibold">最近动态</h2>
            </div>

            <WeeklySummaryCard
                weekFeedCount={data.weekFeedCount}
                weekMoodCounts={data.weekMoodCounts}
                weekAbnormalPoopCount={data.weekAbnormalPoopCount}
                weekWeightDelta={data.weekWeightDelta}
            />

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
                                    <button className="diary-expand-btn" onClick={() => setLatestDiaryExpanded(!latestDiaryExpanded)}>
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
        </div>
    )
}
