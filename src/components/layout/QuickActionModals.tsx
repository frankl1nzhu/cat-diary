import { useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../lib/auth'
import { useCat } from '../../lib/useCat'
import { useToastStore } from '../../stores/useToastStore'
import { useQuickActionStore } from '../../stores/useQuickActionStore'
import { useOnlineStatus } from '../../lib/useOnlineStatus'
import { getErrorMessage } from '../../lib/errorMessage'
import { lightHaptic } from '../../lib/haptics'
import { compressImage } from '../../lib/imageCompress'
import { sendAbnormalPoopNotification, sendMissNotification, sendDiaryNotification, sendHealthNotification } from '../../lib/pushServer'
import { BRISTOL_LABELS, POOP_COLOR_LABELS, isAbnormalPoop, INVENTORY_ICONS, DIARY_TAGS, getDiaryTagLabel } from '../../lib/constants'
import { useI18n } from '../../lib/i18n'
import { format } from 'date-fns'
import type { BristolType, PoopColor, InventoryItem, InventoryStatus, FeedStatus, DiaryEntry } from '../../types/database.types'
import { computeInventoryStatus } from '../../types/database.types'

type HealthFormType = 'vaccine' | 'deworming' | 'medical' | 'vomit'

export function QuickActionModals() {
    const { language } = useI18n()
    const l = useCallback((zh: string, en: string) => (language === 'zh' ? zh : en), [language])
    const { user } = useSession()
    const { cat, catId } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()
    const { activeAction, closeAction } = useQuickActionStore()

    // ─── Poop state ──────────────────────────────────
    const [selectedBristol, setSelectedBristol] = useState<BristolType>('4')
    const [selectedColor, setSelectedColor] = useState<PoopColor>('brown')
    const [poopSaving, setPoopSaving] = useState(false)

    // ─── Feed state ──────────────────────────────────
    const [feedInventory, setFeedInventory] = useState<InventoryItem[]>([])
    const [todayFeeds, setTodayFeeds] = useState<FeedStatus[]>([])
    const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryItem | null>(null)
    const [feedGrams, setFeedGrams] = useState('')
    const [feedLoading, setFeedLoading] = useState(false)
    const [feedDataLoaded, setFeedDataLoaded] = useState(false)

    // ─── Diary state ─────────────────────────────────
    const [diaryText, setDiaryText] = useState('')
    const [diaryTags, setDiaryTags] = useState<string[]>([])
    const [diaryImage, setDiaryImage] = useState<File | null>(null)
    const [diaryImagePreview, setDiaryImagePreview] = useState<string | null>(null)
    const [diarySaving, setDiarySaving] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ─── Weight state ────────────────────────────────
    const [weightValue, setWeightValue] = useState('')
    const [weightError, setWeightError] = useState('')
    const [weightSaving, setWeightSaving] = useState(false)

    // ─── Inventory state ─────────────────────────────
    const [invItemName, setInvItemName] = useState('')
    const [invIcon, setInvIcon] = useState<string | null>(null)
    const [invTotalQty, setInvTotalQty] = useState('')
    const [invAlertThreshold, setInvAlertThreshold] = useState('')
    const [invSaving, setInvSaving] = useState(false)

    // ─── Health state ────────────────────────────────
    const [healthType, setHealthType] = useState<HealthFormType>('vaccine')
    const [healthName, setHealthName] = useState('')
    const [healthDate, setHealthDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [healthNextDue, setHealthNextDue] = useState('')
    const [healthMedicalPreset, setHealthMedicalPreset] = useState<'vomit' | 'cough' | 'fever' | 'other'>('vomit')
    const [healthNotes, setHealthNotes] = useState('')
    const [healthSaving, setHealthSaving] = useState(false)

    // ─── Expiry state ────────────────────────────────
    const [expiryItemName, setExpiryItemName] = useState('')
    const [expiryInHours, setExpiryInHours] = useState('48')
    const [expirySaving, setExpirySaving] = useState(false)
    const [expiryInventory, setExpiryInventory] = useState<InventoryItem[]>([])
    const [expiryInventoryLoaded, setExpiryInventoryLoaded] = useState(false)

    // ─── Random diary (miss cat) ─────────────────────
    const [randomDiary, setRandomDiary] = useState<DiaryEntry | null>(null)
    const [randomDiaryOpen, setRandomDiaryOpen] = useState(false)

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

    const healthTypeLabels = useMemo<Record<HealthFormType, { icon: string; label: string }>>(() => ({
        vaccine: { icon: '💉', label: l('疫苗', 'Vaccine') },
        deworming: { icon: '💊', label: l('驱虫', 'Deworming') },
        medical: { icon: '🏥', label: l('就医', 'Medical') },
        vomit: { icon: '🤮', label: l('呕吐', 'Vomit') },
    }), [l])

    const expiryPreviewDateTime = useMemo(() => {
        const h = Math.floor(Number(expiryInHours))
        if (!Number.isFinite(h) || h <= 0) return null
        return format(new Date(Date.now() + h * 60 * 60 * 1000), 'yyyy-MM-dd HH:mm')
    }, [expiryInHours])

    // ─── Load feed data on demand ────────────────────
    const loadFeedData = useCallback(async () => {
        if (!catId || feedDataLoaded) return
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const [invRes, feedRes] = await Promise.all([
            supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true }),
            supabase.from('feed_status').select('*').eq('cat_id', catId).gte('fed_at', todayStart.toISOString()).order('fed_at', { ascending: false }),
        ])
        if (invRes.data) setFeedInventory(invRes.data)
        if (feedRes.data) setTodayFeeds(feedRes.data)
        setFeedDataLoaded(true)
    }, [catId, feedDataLoaded])

    // ─── Load expiry inventory on demand ────────────
    const loadExpiryData = useCallback(async () => {
        if (!catId || expiryInventoryLoaded) return
        const { data } = await supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true })
        if (data) setExpiryInventory(data)
        setExpiryInventoryLoaded(true)
    }, [catId, expiryInventoryLoaded])

    // ─── Reset functions ─────────────────────────────
    const resetPoop = () => { setSelectedBristol('4'); setSelectedColor('brown') }
    const resetFeed = () => { setSelectedInventoryItem(null); setFeedGrams(''); setFeedDataLoaded(false) }
    const resetDiary = () => {
        setDiaryText(''); setDiaryTags([]); setDiaryImage(null)
        if (diaryImagePreview?.startsWith('blob:')) URL.revokeObjectURL(diaryImagePreview)
        setDiaryImagePreview(null)
    }
    const resetWeight = () => { setWeightValue(''); setWeightError('') }
    const resetInv = () => { setInvItemName(''); setInvIcon(null); setInvTotalQty(''); setInvAlertThreshold('') }
    const resetHealth = () => { setHealthName(''); setHealthDate(format(new Date(), 'yyyy-MM-dd')); setHealthNextDue(''); setHealthMedicalPreset('vomit'); setHealthNotes(''); setHealthType('vaccine') }
    const resetExpiry = () => { setExpiryItemName(''); setExpiryInHours('48'); setExpiryInventory([]); setExpiryInventoryLoaded(false) }

    const closeAndReset = (resetFn: () => void) => {
        closeAction()
        resetFn()
    }

    // ─── Poop handler ────────────────────────────────
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
            closeAndReset(resetPoop)
            lightHaptic()
            pushToast('success', l('铲屎记录成功 💩', 'Poop log saved 💩'))
            if (isAbnormalPoop(selectedBristol, selectedColor)) {
                sendAbnormalPoopNotification(cat.id, cat.name, selectedBristol, selectedColor).catch(() => {})
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('铲屎记录失败，请稍后重试', 'Failed to save poop log. Please try again later.')))
        } finally {
            setPoopSaving(false)
        }
    }

    // ─── Feed handler ────────────────────────────────
    const handleFeedRecord = async () => {
        if (!cat || !user || feedLoading || !selectedInventoryItem) return
        const grams = parseFloat(feedGrams)
        if (isNaN(grams) || grams <= 0) return
        setFeedLoading(true)

        const mealTypeValue = `${selectedInventoryItem.item_name}|${grams}`
        try {
            const { error: feedError } = await supabase.from('feed_status').insert({
                cat_id: cat.id,
                status: 'fed' as const,
                fed_by: user.id,
                fed_at: new Date().toISOString(),
                meal_type: mealTypeValue,
            })
            if (feedError) throw feedError
            if (selectedInventoryItem.total_quantity != null) {
                const newQty = Math.max(0, selectedInventoryItem.total_quantity - grams)
                const updatedItem = { ...selectedInventoryItem, total_quantity: newQty }
                const newStatus = computeInventoryStatus(updatedItem)
                const { error: invError } = await supabase.from('inventory')
                    .update({ total_quantity: newQty, status: newStatus, updated_by: user.id })
                    .eq('id', selectedInventoryItem.id)
                if (invError) throw invError
            }
            closeAndReset(resetFeed)
            lightHaptic()
            pushToast('success', l('喂食记录成功 🐾', 'Feeding saved 🐾'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('喂食记录失败，请稍后重试', 'Failed to save feeding. Please try again later.')))
        } finally {
            setFeedLoading(false)
        }
    }

    // ─── Diary handler ───────────────────────────────
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0]
        if (!rawFile) return
        if (rawFile.size > 10 * 1024 * 1024) {
            pushToast('error', l('图片过大，最大 10MB', 'Image too large, max 10MB'))
            e.target.value = ''
            return
        }
        const file = await compressImage(rawFile)
        setDiaryImage(file)
        if (diaryImagePreview?.startsWith('blob:')) URL.revokeObjectURL(diaryImagePreview)
        setDiaryImagePreview(URL.createObjectURL(file))
    }

    const toggleTag = (tag: string) => {
        setDiaryTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
    }

    const handleDiarySave = async () => {
        if (!catId || !user) return
        if (!diaryText.trim() && !diaryImage) return
        setDiarySaving(true)
        try {
            let imageUrl: string | null = null
            if (diaryImage) {
                const ext = diaryImage.name.split('.').pop()
                const path = `diary/${Date.now()}.${ext}`
                const { error: upErr } = await supabase.storage.from('cat-photos').upload(path, diaryImage, { upsert: true })
                if (upErr) throw upErr
                const { data: urlData } = supabase.storage.from('cat-photos').getPublicUrl(path)
                imageUrl = urlData.publicUrl
            }
            await supabase.from('diary_entries').insert({
                cat_id: catId,
                text: diaryText.trim() || null,
                image_url: imageUrl,
                tags: diaryTags,
                created_by: user.id,
            })
            closeAndReset(resetDiary)
            lightHaptic()
            pushToast('success', l('日记已发布 📝', 'Diary published 📝'))
            if (cat) sendDiaryNotification(catId, cat.name).catch(() => {})
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('日记发布失败，请稍后重试', 'Failed to publish diary. Please try again later.')))
        } finally {
            setDiarySaving(false)
        }
    }

    // ─── Weight handler ──────────────────────────────
    const handleWeightSave = async () => {
        if (!catId || !user) return
        const kg = parseFloat(weightValue)
        if (isNaN(kg) || kg < 0.1 || kg > 30) {
            setWeightError(l('体重范围 0.1-30 kg', 'Weight range 0.1-30 kg'))
            return
        }
        setWeightError('')
        setWeightSaving(true)
        try {
            await supabase.from('weight_records').insert({
                cat_id: catId,
                weight_kg: kg,
                recorded_at: new Date().toISOString(),
                created_by: user.id,
            })
            closeAndReset(resetWeight)
            lightHaptic()
            pushToast('success', l('体重记录成功 ⚖️', 'Weight recorded ⚖️'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('体重记录失败，请稍后重试', 'Failed to save weight. Please try again later.')))
        } finally {
            setWeightSaving(false)
        }
    }

    // ─── Inventory handler ───────────────────────────
    const handleInventorySave = async () => {
        if (!catId || !user || !invItemName.trim()) return
        const totalQty = invTotalQty ? parseFloat(invTotalQty) : null
        const alertThreshold = invAlertThreshold ? parseFloat(invAlertThreshold) : null
        const fakeItem = { total_quantity: totalQty, daily_consumption: alertThreshold, status: 'plenty' as InventoryStatus } as InventoryItem
        const status = computeInventoryStatus(fakeItem)
        setInvSaving(true)
        try {
            await supabase.from('inventory').insert({
                cat_id: catId,
                item_name: invItemName.trim(),
                icon: invIcon,
                status,
                total_quantity: totalQty,
                daily_consumption: alertThreshold,
                updated_by: user.id,
            })
            closeAndReset(resetInv)
            lightHaptic()
            pushToast('success', l('库存已更新', 'Inventory updated'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('库存保存失败，请稍后重试', 'Failed to save inventory, please try again later')))
        } finally {
            setInvSaving(false)
        }
    }

    // ─── Health handler ──────────────────────────────
    const handleHealthSave = async () => {
        if (!catId || !user || !healthName.trim()) return
        setHealthSaving(true)
        try {
            const payloadType = healthType === 'vomit' ? 'medical' : healthType
            const payloadName = healthType === 'vomit' ? l('呕吐', 'Vomit') : healthName.trim()
            const payloadNextDue = payloadType === 'medical' ? null : (healthNextDue || null)
            await supabase.from('health_records').insert({
                cat_id: catId,
                type: payloadType,
                name: payloadName,
                date: healthDate,
                next_due: payloadNextDue,
                notes: healthNotes.trim() || null,
                created_by: user.id,
            })
            closeAndReset(resetHealth)
            lightHaptic()
            pushToast('success', l('健康记录已保存', 'Health record saved'))
            const typeLabel = healthType === 'vomit' ? l('呕吐', 'Vomit')
                : healthType === 'vaccine' ? l('疫苗', 'Vaccine')
                : healthType === 'deworming' ? l('驱虫', 'Deworming')
                : l('就医', 'Medical')
            sendHealthNotification(catId, cat?.name || l('猫咪', 'Cat'), typeLabel, payloadName).catch(() => {})
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('健康记录保存失败，请稍后重试', 'Failed to save health record, please try again later')))
        } finally {
            setHealthSaving(false)
        }
    }

    // ─── Expiry handler ──────────────────────────────
    const handleExpiryReminderSave = async () => {
        if (!catId || !user || !expiryItemName.trim()) return
        const hours = Math.floor(Number(expiryInHours))
        if (!Number.isFinite(hours) || hours <= 0) {
            pushToast('error', l('请填写大于 0 的过期小时数', 'Please enter an expiry hour value greater than 0'))
            return
        }
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000)
        setExpirySaving(true)
        try {
            const { error } = await supabase.from('inventory_expiry_reminders').insert({
                cat_id: catId,
                item_name: expiryItemName.trim(),
                expires_at: expiresAt.toISOString(),
                created_by: user.id,
            })
            if (error) throw error
            closeAndReset(resetExpiry)
            lightHaptic()
            pushToast('success', l('过期提醒已添加', 'Expiry reminder added'))
        } catch (err) {
            pushToast('error', getErrorMessage(err, l('过期提醒保存失败，请稍后重试', 'Failed to save expiry reminder, please try again later')))
        } finally {
            setExpirySaving(false)
        }
    }

    // ─── Miss cat handler (called from BottomNav) ────
    // This is triggered differently — not via modal but from QuickActions button on dashboard.
    // We don't handle miss here since it's a one-click action in QuickActions.

    // Load feed data when feed modal opens
    if (activeAction === 'feed' && !feedDataLoaded) {
        loadFeedData()
    }

    // Load inventory when expiry modal opens
    if (activeAction === 'expiry' && !expiryInventoryLoaded) {
        loadExpiryData()
    }

    return (
        <>
            {/* ── Poop Modal ── */}
            <Modal isOpen={activeAction === 'poop'} onClose={() => closeAndReset(resetPoop)} title={l('💩 铲屎记录', '💩 Poop Log')}>
                <div className="poop-form">
                    <div className="form-section">
                        <label className="form-label">{l('布里斯托分类', 'Bristol type')}</label>
                        <select
                            className="form-input"
                            aria-label={l('布里斯托类型选择', 'Choose bristol type')}
                            value={selectedBristol}
                            onChange={(e) => setSelectedBristol(e.target.value as BristolType)}
                        >
                            {(['1', '2', '3', '4', '5', '6', '7'] as BristolType[]).map((type) => (
                                <option key={type} value={type}>
                                    {l('类型', 'Type')} {type} · {bristolLabels[type]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-section">
                        <label className="form-label">{l('颜色', 'Color')}</label>
                        <div className="color-grid compact" role="radiogroup" aria-label={l('便便颜色选择', 'Choose poop color')}>
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
                        {poopSaving ? l('记录中...', 'Saving...') : l('保存记录', 'Save record')}
                    </Button>
                </div>
            </Modal>

            {/* ── Feed Modal ── */}
            <Modal isOpen={activeAction === 'feed'} onClose={() => closeAndReset(resetFeed)} title={l('🍽️ 记录喂食', '🍽️ Feeding Log')}>
                <div className="feed-form">
                    <label className="form-label">{l('选择库存物资', 'Choose from inventory')}</label>
                    {feedInventory.length > 0 ? (
                        <div className="feed-inventory-list">
                            {feedInventory.map((item) => (
                                <button
                                    key={item.id}
                                    className={`feed-inventory-btn ${selectedInventoryItem?.id === item.id ? 'feed-inventory-btn-active' : ''}`}
                                    onClick={() => setSelectedInventoryItem(item)}
                                >
                                    <span>{item.icon || '📦'} {item.item_name}</span>
                                    {item.total_quantity != null && (
                                        <span className="text-xs text-muted">{item.total_quantity}g</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted">{l('暂无库存物资，请先添加', 'No inventory items yet. Add some first.')}</p>
                    )}

                    {selectedInventoryItem && (
                        <div className="form-section">
                            <label className="form-label" htmlFor="qa-feed-grams">{l('喂食量（克）', 'Amount (grams)')}</label>
                            <input
                                id="qa-feed-grams"
                                type="number"
                                className="form-input"
                                inputMode="decimal"
                                min="0.1"
                                step="0.1"
                                placeholder={l('输入克数', 'Enter grams')}
                                value={feedGrams}
                                onChange={(e) => setFeedGrams(e.target.value)}
                            />
                        </div>
                    )}

                    {todayFeeds.length > 0 && (
                        <div className="feed-history">
                            <label className="form-label">{l('今日记录', 'Today records')}</label>
                            {todayFeeds.map((f) => {
                                const parts = f.meal_type.split('|')
                                const displayName = parts[0]
                                const displayGrams = parts[1] ? `${parts[1]}g` : ''
                                return (
                                    <div key={f.id} className="feed-history-item">
                                        <span>{displayName} {displayGrams}</span>
                                        <span className="text-muted text-xs">{format(new Date(f.fed_at!), 'HH:mm')}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleFeedRecord}
                        disabled={feedLoading || !online || !selectedInventoryItem || !feedGrams || parseFloat(feedGrams) <= 0}
                    >
                        {feedLoading ? l('记录中...', 'Saving...') : l('确认喂食 🐾', 'Confirm feeding 🐾')}
                    </Button>
                </div>
            </Modal>

            {/* ── Diary Modal ── */}
            <Modal isOpen={activeAction === 'diary'} onClose={() => closeAndReset(resetDiary)} title={l('📝 写日记', '📝 Write Diary')}>
                <div className="diary-form">
                    <div className="form-group">
                        <textarea
                            className="form-input diary-textarea"
                            placeholder={l('记录今天的故事...', 'Write about today...')}
                            value={diaryText}
                            onChange={(e) => setDiaryText(e.target.value)}
                            maxLength={500}
                            rows={4}
                        />
                        <p className="text-muted text-xs">{diaryText.length}/500</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{l('标签', 'Tags')}</label>
                        <div className="tag-picker">
                            {DIARY_TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    className={`tag-btn ${diaryTags.includes(tag) ? 'tag-btn-active' : ''}`}
                                    onClick={() => toggleTag(tag)}
                                >
                                    #{getDiaryTagLabel(tag, language)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{l('照片', 'Photos')}</label>
                        {diaryImagePreview ? (
                            <div className="image-preview-container">
                                <img src={diaryImagePreview} alt="" className="image-preview" loading="lazy" />
                                <button className="image-remove" onClick={() => { setDiaryImage(null); setDiaryImagePreview(null) }}>✕</button>
                            </div>
                        ) : (
                            <button className="photo-upload-btn" onClick={() => fileInputRef.current?.click()}>
                                {l('选择图片', 'Pick a photo')}
                            </button>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="file-input-hidden"
                            onChange={handleImageSelect}
                        />
                    </div>

                    <Button variant="primary" fullWidth onClick={handleDiarySave} disabled={diarySaving || !online}>
                        {diarySaving ? l('发布中...', 'Publishing...') : l('发布日记', 'Publish diary')}
                    </Button>
                </div>
            </Modal>

            {/* ── Weight Modal ── */}
            <Modal isOpen={activeAction === 'weight'} onClose={() => closeAndReset(resetWeight)} title={l('⚖️ 添加体重', '⚖️ Add Weight')}>
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label">{l('体重 (kg)', 'Weight (kg)')}</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="30"
                            className="form-input weight-input"
                            value={weightValue}
                            onChange={(e) => { setWeightValue(e.target.value); setWeightError('') }}
                            autoFocus
                            aria-invalid={weightError ? true : undefined}
                            aria-describedby={weightError ? 'qa-weight-error' : undefined}
                        />
                        {weightError && <p className="text-xs text-danger" id="qa-weight-error">{weightError}</p>}
                    </div>
                    <Button variant="primary" fullWidth onClick={handleWeightSave} disabled={weightSaving || !online}>
                        {weightSaving ? l('保存中...', 'Saving...') : l('保存体重', 'Save weight')}
                    </Button>
                </div>
            </Modal>

            {/* ── Inventory Modal ── */}
            <Modal isOpen={activeAction === 'inventory'} onClose={() => closeAndReset(resetInv)} title={l('📦 添加物资', '📦 Add Inventory')}>
                <div className="inv-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="qa-inv-name">{l('物资名称', 'Item name')}</label>
                        <input
                            id="qa-inv-name"
                            className="form-input"
                            placeholder={l('如：猫粮、猫砂、罐头', 'e.g. Cat food, litter, canned food')}
                            value={invItemName}
                            onChange={(e) => setInvItemName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{l('图标', 'Icon')}</label>
                        <div className="inv-icon-grid">
                            {INVENTORY_ICONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    className={`inv-icon-btn ${invIcon === opt.value ? 'inv-icon-active' : ''}`}
                                    onClick={() => setInvIcon(invIcon === opt.value ? null : opt.value)}
                                    title={opt.label}
                                >
                                    {opt.value}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="qa-inv-total-qty">{l('总量', 'Total quantity')}</label>
                            <input
                                id="qa-inv-total-qty"
                                type="number"
                                min="0"
                                step="0.1"
                                className="form-input"
                                placeholder={l('如：5000（克）', 'e.g. 5000 (grams)')}
                                value={invTotalQty}
                                onChange={(e) => setInvTotalQty(e.target.value)}
                            />
                        </div>
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="qa-inv-alert">{l('提醒线', 'Alert threshold')}</label>
                            <input
                                id="qa-inv-alert"
                                type="number"
                                min="0"
                                step="0.1"
                                className="form-input"
                                placeholder={l('如：500', 'e.g. 500')}
                                value={invAlertThreshold}
                                onChange={(e) => setInvAlertThreshold(e.target.value)}
                            />
                        </div>
                    </div>

                    {invTotalQty && invAlertThreshold && parseFloat(invAlertThreshold) > 0 && (
                        <div className="inv-preview" style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--glass-bg)' }}>
                            <p className="text-sm text-secondary">
                                {(() => {
                                    const qty = parseFloat(invTotalQty)
                                    const threshold = parseFloat(invAlertThreshold)
                                    if (qty <= threshold) return <span style={{ color: 'var(--color-danger)' }}>{l('🔴 已达提醒线', '🔴 Below threshold')}</span>
                                    if (qty <= threshold * 1.5) return <span style={{ color: 'var(--color-warning)' }}>{l('🟡 接近提醒线', '🟡 Near threshold')}</span>
                                    return <span style={{ color: 'var(--color-success)' }}>{l('🟢 充足', '🟢 Sufficient')}</span>
                                })()}
                            </p>
                        </div>
                    )}

                    <Button variant="primary" fullWidth onClick={handleInventorySave} disabled={invSaving || !online}>
                        {invSaving ? l('保存中...', 'Saving...') : l('添加物资', 'Add inventory')}
                    </Button>
                </div>
            </Modal>

            {/* ── Health Modal ── */}
            <Modal isOpen={activeAction === 'health'} onClose={() => closeAndReset(resetHealth)} title={l('💉 添加健康记录', '💉 Add Health Record')}>
                <div className="health-form">
                    <div className="form-group">
                        <label className="form-label">{l('类型', 'Type')}</label>
                        <div className="health-type-grid">
                            {(['vaccine', 'deworming', 'medical', 'vomit'] as const).map((t) => (
                                <button
                                    key={t}
                                    className={`health-type-btn ${healthType === t ? 'health-type-active' : ''}`}
                                    onClick={() => {
                                        setHealthType(t)
                                        if (t === 'medical') {
                                            const map = { vomit: l('呕吐', 'Vomit'), cough: l('咳嗽', 'Cough'), fever: l('发热', 'Fever'), other: '' }
                                            setHealthName(map[healthMedicalPreset])
                                            setHealthNextDue('')
                                        }
                                        if (t === 'vomit') { setHealthName(l('呕吐', 'Vomit')); setHealthNextDue('') }
                                    }}
                                >
                                    {healthTypeLabels[t].icon} {healthTypeLabels[t].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {healthType === 'medical' ? (
                        <>
                            <div className="form-group">
                                <label className="form-label" htmlFor="qa-health-medical-preset">{l('就医类型', 'Medical type')}</label>
                                <select
                                    id="qa-health-medical-preset"
                                    className="form-input"
                                    value={healthMedicalPreset}
                                    onChange={(e) => {
                                        const next = e.target.value as 'vomit' | 'cough' | 'fever' | 'other'
                                        setHealthMedicalPreset(next)
                                        if (next === 'vomit') setHealthName(l('呕吐', 'Vomit'))
                                        if (next === 'cough') setHealthName(l('咳嗽', 'Cough'))
                                        if (next === 'fever') setHealthName(l('发热', 'Fever'))
                                        if (next === 'other') setHealthName('')
                                    }}
                                >
                                    <option value="vomit">{l('呕吐', 'Vomit')}</option>
                                    <option value="cough">{l('咳嗽', 'Cough')}</option>
                                    <option value="fever">{l('发热', 'Fever')}</option>
                                    <option value="other">{l('其他', 'Other')}</option>
                                </select>
                            </div>
                            {healthMedicalPreset === 'other' && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="qa-health-name">{l('症状名称', 'Symptom name')}</label>
                                    <input
                                        id="qa-health-name"
                                        className="form-input"
                                        placeholder={l('请输入症状', 'Enter symptom')}
                                        value={healthName}
                                        onChange={(e) => setHealthName(e.target.value)}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label" htmlFor="qa-health-notes">{l('症状备注', 'Symptom notes')}</label>
                                <textarea
                                    id="qa-health-notes"
                                    className="form-input"
                                    placeholder={l('可填写频次、状态、触发情况', 'Optional frequency, status and trigger notes')}
                                    rows={3}
                                    value={healthNotes}
                                    onChange={(e) => setHealthNotes(e.target.value)}
                                />
                            </div>
                        </>
                    ) : healthType === 'vomit' ? (
                        <div className="form-group">
                            <label className="form-label" htmlFor="qa-health-notes-vomit">{l('呕吐备注', 'Vomit notes')}</label>
                            <textarea
                                id="qa-health-notes-vomit"
                                className="form-input"
                                placeholder={l('可填写频次、状态、触发情况', 'Optional frequency, status and trigger notes')}
                                rows={3}
                                value={healthNotes}
                                onChange={(e) => setHealthNotes(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label" htmlFor="qa-health-name-2">{l('名称', 'Name')}</label>
                            <input
                                id="qa-health-name-2"
                                className="form-input"
                                placeholder={healthType === 'vaccine' ? l('如：三联疫苗', 'e.g. FVRCP vaccine') : l('如：大宠爱', 'e.g. Broadline')}
                                value={healthName}
                                onChange={(e) => setHealthName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="qa-health-date">{l('日期', 'Date')}</label>
                            <input
                                id="qa-health-date"
                                type="date"
                                className="form-input"
                                value={healthDate}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => setHealthDate(e.target.value)}
                            />
                        </div>
                        {(healthType === 'vaccine' || healthType === 'deworming') && (
                            <div className="form-group flex-1">
                                <label className="form-label" htmlFor="qa-health-next">{l('下次到期', 'Next due')}</label>
                                <input
                                    id="qa-health-next"
                                    type="date"
                                    className="form-input"
                                    value={healthNextDue}
                                    min={healthDate || undefined}
                                    onChange={(e) => setHealthNextDue(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <Button variant="primary" fullWidth onClick={handleHealthSave} disabled={healthSaving || !online}>
                        {healthSaving ? l('保存中...', 'Saving...') : l('保存记录', 'Save record')}
                    </Button>
                </div>
            </Modal>

            {/* ── Expiry Reminder Modal ── */}
            <Modal isOpen={activeAction === 'expiry'} onClose={() => closeAndReset(resetExpiry)} title={l('🗑️ 添加过期提醒', '🗑️ Add Expiry Reminder')}>
                <div className="inv-form">
                    <div className="form-group">
                        <label className="form-label">{l('选择库存物品', 'Choose from inventory')}</label>
                        {expiryInventory.length > 0 ? (
                            <div className="feed-inventory-list">
                                {expiryInventory.map((item) => (
                                    <button
                                        key={item.id}
                                        className={`feed-inventory-btn ${expiryItemName === item.item_name ? 'feed-inventory-btn-active' : ''}`}
                                        onClick={() => setExpiryItemName(item.item_name)}
                                    >
                                        <span>{item.icon || '📦'} {item.item_name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted">{expiryInventoryLoaded ? l('暂无库存物品，请先添加', 'No inventory items yet. Add some first.') : l('加载中...', 'Loading...')}</p>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="qa-expiry-in-hours">{l('多久后过期（小时）', 'Expires in (hours)')}</label>
                        <input
                            id="qa-expiry-in-hours"
                            type="number"
                            min="1"
                            step="1"
                            className="form-input"
                            value={expiryInHours}
                            onChange={(e) => setExpiryInHours(e.target.value)}
                        />
                        <p className="text-xs text-muted" style={{ marginTop: '6px' }}>
                            {expiryPreviewDateTime ? l(`预计过期时间：${expiryPreviewDateTime}`, `Estimated expiry time: ${expiryPreviewDateTime}`) : l('请输入有效小时数', 'Please enter valid hours')}
                        </p>
                    </div>

                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleExpiryReminderSave}
                        disabled={expirySaving || !online || !expiryItemName.trim()}
                    >
                        {expirySaving ? l('保存中...', 'Saving...') : l('保存提醒', 'Save reminder')}
                    </Button>
                </div>
            </Modal>

            {/* ── Random Diary Modal (miss cat) ── */}
            <Modal isOpen={randomDiaryOpen} onClose={() => setRandomDiaryOpen(false)} title={l(`🥹 ${cat?.name || '猫咪'}的回忆`, `🥹 ${cat?.name || 'cat'}'s memories`)}>
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
