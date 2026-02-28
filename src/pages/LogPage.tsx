import { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SwipeableRow } from '../components/ui/SwipeableRow'
import { EmptyCatIllustration } from '../components/ui/EmptyCatIllustration'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useToastStore } from '../stores/useToastStore'
import { useRealtimeSubscription } from '../lib/realtime'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { getErrorMessage } from '../lib/errorMessage'
import { compressImage } from '../lib/imageCompress'
import { lightHaptic } from '../lib/haptics'
import { sendDiaryNotification } from '../lib/pushServer'
import { BRISTOL_LABELS, POOP_COLOR_EMOJIS, isAbnormalPoop, DIARY_TAGS } from '../lib/constants'
import { format } from 'date-fns'
import type { DiaryEntry, DiaryComment, DiaryReaction, PoopLog, WeightRecord } from '../types/database.types'
import './LogPage.css'

type TimelineItem =
    | { type: 'diary'; data: DiaryEntry; time: string }
    | { type: 'poop'; data: PoopLog; time: string }
    | { type: 'weight'; data: WeightRecord; time: string }

const TAGS = DIARY_TAGS

export function LogPage() {
    const { user } = useSession()
    const { cat, catId, loading: catLoading } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()
    const [searchParams, setSearchParams] = useSearchParams()

    const [timeline, setTimeline] = useState<TimelineItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadLimit, setLoadLimit] = useState(50)
    const [hasMore, setHasMore] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [pullDistance, setPullDistance] = useState(0)

    // New diary modal
    const [diaryOpen, setDiaryOpen] = useState(false)
    const [diaryText, setDiaryText] = useState('')
    const [diaryTags, setDiaryTags] = useState<string[]>([])
    const [diaryImage, setDiaryImage] = useState<File | null>(null)
    const [diaryImagePreview, setDiaryImagePreview] = useState<string | null>(null)
    const [editingDiaryId, setEditingDiaryId] = useState<string | null>(null)
    const [diarySaving, setDiarySaving] = useState(false)

    // New weight modal
    const [weightOpen, setWeightOpen] = useState(false)
    const [weightValue, setWeightValue] = useState('')
    const [weightError, setWeightError] = useState('')
    const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
    const [weightSaving, setWeightSaving] = useState(false)

    const [poopOpen, setPoopOpen] = useState(false)
    const [poopBristol, setPoopBristol] = useState<'1' | '2' | '3' | '4' | '5' | '6' | '7'>('4')
    const [poopColor, setPoopColor] = useState<'brown' | 'dark_brown' | 'yellow' | 'green' | 'red' | 'black' | 'white'>('brown')
    const [editingPoopId, setEditingPoopId] = useState<string | null>(null)
    const [poopSaving, setPoopSaving] = useState(false)

    const [imageLightbox, setImageLightbox] = useState<string | null>(null)
    const [lightboxScale, setLightboxScale] = useState(1)
    const [lightboxOffset, setLightboxOffset] = useState({ x: 0, y: 0 })
    const [lightboxDragging, setLightboxDragging] = useState(false)

    const [pendingDeleteItem, setPendingDeleteItem] = useState<TimelineItem | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    // Diary expand/collapse state
    const [expandedDiaries, setExpandedDiaries] = useState<Set<string>>(new Set())
    const DIARY_CHAR_LIMIT = 100

    // Diary comments & reactions
    const [diaryComments, setDiaryComments] = useState<Record<string, DiaryComment[]>>({})
    const [diaryReactions, setDiaryReactions] = useState<Record<string, DiaryReaction[]>>({})
    const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
    const [commentSaving, setCommentSaving] = useState<string | null>(null)
    const [showComments, setShowComments] = useState<Set<string>>(new Set())
    const REACTION_EMOJIS = ['❤️', '😂', '😍', '👍', '🐱', '🐾']

    const [keyword, setKeyword] = useState('')
    const deferredKeyword = useDeferredValue(keyword)
    const [filterTypes, setFilterTypes] = useState<Array<TimelineItem['type']>>(['diary'])
    const [dateStart, setDateStart] = useState('')
    const [dateEnd, setDateEnd] = useState('')

    const fileInputRef = useRef<HTMLInputElement>(null)
    const pullStartYRef = useRef<number | null>(null)
    const pinchStartDistanceRef = useRef<number | null>(null)
    const lastTapAtRef = useRef(0)
    const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)
    const lightboxRef = useRef<HTMLDivElement>(null)
    const dateRangeInitializedRef = useRef(false)

    // ─── Load timeline ────────────────────────────
    const loadTimeline = useCallback(async (nextLimit?: number) => {
        if (!catId) {
            if (!catLoading) setLoading(false)
            return
        }

        const effectiveLimit = nextLimit ?? loadLimit

        try {
            const [diaries, poops, weights] = await Promise.all([
                supabase.from('diary_entries').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(effectiveLimit),
                supabase.from('poop_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(effectiveLimit),
                supabase.from('weight_records').select('*').eq('cat_id', catId).order('recorded_at', { ascending: false }).limit(effectiveLimit),
            ])

            const items: TimelineItem[] = []
            diaries.data?.forEach((d) => items.push({ type: 'diary', data: d, time: d.created_at }))
            poops.data?.forEach((p) => items.push({ type: 'poop', data: p, time: p.created_at }))
            weights.data?.forEach((w) => items.push({ type: 'weight', data: w, time: w.recorded_at }))

            items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            setTimeline(items)
            setHasMore(
                (diaries.data?.length || 0) >= effectiveLimit
                || (poops.data?.length || 0) >= effectiveLimit
                || (weights.data?.length || 0) >= effectiveLimit
            )
        } catch (err) {
            console.error('Failed to load timeline:', err)
            pushToast('error', getErrorMessage(err, '时间线加载失败，请稍后重试'))
        } finally {
            setLoading(false)
        }
    }, [catId, catLoading, loadLimit, pushToast])

    useEffect(() => { loadTimeline() }, [loadTimeline])

    // Load comments & reactions for visible diary entries
    const loadDiaryMeta = useCallback(async (diaryIds: string[]) => {
        if (diaryIds.length === 0) return
        try {
            const [commentsRes, reactionsRes] = await Promise.all([
                supabase.from('diary_comments').select('*').in('diary_id', diaryIds).order('created_at', { ascending: true }),
                supabase.from('diary_reactions').select('*').in('diary_id', diaryIds),
            ])
            if (commentsRes.data) {
                const map: Record<string, DiaryComment[]> = {}
                commentsRes.data.forEach((c) => {
                    if (!map[c.diary_id]) map[c.diary_id] = []
                    map[c.diary_id].push(c)
                })
                setDiaryComments((prev) => ({ ...prev, ...map }))
            }
            if (reactionsRes.data) {
                const map: Record<string, DiaryReaction[]> = {}
                reactionsRes.data.forEach((r) => {
                    if (!map[r.diary_id]) map[r.diary_id] = []
                    map[r.diary_id].push(r)
                })
                setDiaryReactions((prev) => ({ ...prev, ...map }))
            }
        } catch { /* silent */ }
    }, [])

    useEffect(() => {
        const diaryIds = timeline.filter((t) => t.type === 'diary').map((t) => t.data.id)
        loadDiaryMeta(diaryIds)
    }, [timeline, loadDiaryMeta])

    const toggleDiaryExpand = (id: string) => {
        setExpandedDiaries((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleShowComments = (id: string) => {
        setShowComments((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleToggleReaction = async (diaryId: string, emoji: string) => {
        if (!user) return
        const existing = (diaryReactions[diaryId] || []).find((r) => r.user_id === user.id && r.emoji === emoji)
        try {
            if (existing) {
                await supabase.from('diary_reactions').delete().eq('id', existing.id)
                setDiaryReactions((prev) => ({
                    ...prev,
                    [diaryId]: (prev[diaryId] || []).filter((r) => r.id !== existing.id),
                }))
            } else {
                const { data, error } = await supabase.from('diary_reactions')
                    .insert({ diary_id: diaryId, user_id: user.id, emoji })
                    .select()
                    .single()
                if (error) throw error
                if (data) {
                    setDiaryReactions((prev) => ({
                        ...prev,
                        [diaryId]: [...(prev[diaryId] || []), data],
                    }))
                }
            }
            lightHaptic()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '操作失败'))
        }
    }

    const handleAddComment = async (diaryId: string) => {
        if (!user) return
        const text = (commentInputs[diaryId] || '').trim()
        if (!text) return
        setCommentSaving(diaryId)
        try {
            const { data, error } = await supabase.from('diary_comments')
                .insert({ diary_id: diaryId, user_id: user.id, text })
                .select()
                .single()
            if (error) throw error
            if (data) {
                setDiaryComments((prev) => ({
                    ...prev,
                    [diaryId]: [...(prev[diaryId] || []), data],
                }))
            }
            setCommentInputs((prev) => ({ ...prev, [diaryId]: '' }))
            lightHaptic()
            pushToast('success', '评论已发布')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '评论失败'))
        } finally {
            setCommentSaving(null)
        }
    }

    const handleDeleteComment = async (commentId: string, diaryId: string) => {
        try {
            await supabase.from('diary_comments').delete().eq('id', commentId)
            setDiaryComments((prev) => ({
                ...prev,
                [diaryId]: (prev[diaryId] || []).filter((c) => c.id !== commentId),
            }))
            lightHaptic()
            pushToast('success', '评论已删除')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除失败'))
        }
    }

    useEffect(() => {
        setLoadLimit(50)
        setFilterTypes(['diary'])
        setDateStart('')
        setDateEnd('')
        dateRangeInitializedRef.current = false
    }, [catId])

    useEffect(() => {
        const quick = searchParams.get('quick')
        if (!quick) return

        if (quick === 'diary') {
            setDiaryOpen(true)
        }
        if (quick === 'weight') {
            setWeightOpen(true)
        }

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('quick')
            return next
        }, { replace: true })
    }, [searchParams, setSearchParams])

    useRealtimeSubscription('diary_entries', () => loadTimeline(),
        catId ? `cat_id=eq.${catId}` : undefined)
    useRealtimeSubscription('poop_logs', () => loadTimeline(),
        catId ? `cat_id=eq.${catId}` : undefined)
    useRealtimeSubscription('weight_records', () => loadTimeline(),
        catId ? `cat_id=eq.${catId}` : undefined)

    useEffect(() => {
        if (dateRangeInitializedRef.current || timeline.length === 0) return
        const sorted = [...timeline].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        const start = format(new Date(sorted[0].time), 'yyyy-MM-dd')
        const end = format(new Date(sorted[sorted.length - 1].time), 'yyyy-MM-dd')
        setDateStart(start)
        setDateEnd(end)
        dateRangeInitializedRef.current = true
    }, [timeline])

    // ─── Add diary ────────────────────────────────
    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawFile = e.target.files?.[0]
        if (!rawFile) return
        if (rawFile.size > 10 * 1024 * 1024) {
            pushToast('error', '图片大小不能超过 10MB')
            e.target.value = ''
            return
        }
        const file = await compressImage(rawFile)
        setDiaryImage(file)
        // Revoke previous preview URL to prevent memory leak
        if (diaryImagePreview && diaryImagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(diaryImagePreview)
        }
        setDiaryImagePreview(URL.createObjectURL(file))
    }

    const openLightbox = (url: string) => {
        setImageLightbox(url)
        setLightboxScale(1)
        setLightboxOffset({ x: 0, y: 0 })
    }

    const closeLightbox = () => {
        setImageLightbox(null)
        setLightboxScale(1)
        setLightboxOffset({ x: 0, y: 0 })
        setLightboxDragging(false)
        pinchStartDistanceRef.current = null
        dragStartRef.current = null
    }

    const updateLightboxScale = (nextScale: number) => {
        const clamped = Math.min(3, Math.max(1, nextScale))
        setLightboxScale(clamped)
        if (clamped === 1) {
            setLightboxOffset({ x: 0, y: 0 })
        }
    }

    const getPinchDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.hypot(dx, dy)
    }

    const onLightboxTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length === 1) {
            const now = Date.now()
            if (now - lastTapAtRef.current < 260) {
                const targetScale = lightboxScale > 1 ? 1 : 2
                updateLightboxScale(targetScale)
            }
            lastTapAtRef.current = now
        }

        if (event.touches.length === 2) {
            pinchStartDistanceRef.current = getPinchDistance(event.touches)
        }
    }

    const onLightboxTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        if (event.touches.length !== 2 || pinchStartDistanceRef.current === null) return
        const distance = getPinchDistance(event.touches)
        const ratio = distance / pinchStartDistanceRef.current
        setLightboxScale((prev) => Math.min(3, Math.max(1, prev * ratio)))
        pinchStartDistanceRef.current = distance
    }

    const onLightboxTouchEnd = () => {
        pinchStartDistanceRef.current = null
    }

    const onLightboxPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (lightboxScale <= 1) return
        dragStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            originX: lightboxOffset.x,
            originY: lightboxOffset.y,
        }
        setLightboxDragging(true)
    }

    const onLightboxPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!dragStartRef.current || lightboxScale <= 1) return
        const deltaX = event.clientX - dragStartRef.current.x
        const deltaY = event.clientY - dragStartRef.current.y
        setLightboxOffset({
            x: dragStartRef.current.originX + deltaX,
            y: dragStartRef.current.originY + deltaY,
        })
    }

    const onLightboxPointerUp = () => {
        dragStartRef.current = null
        setLightboxDragging(false)
    }

    const onLightboxDoubleClick = () => {
        const targetScale = lightboxScale > 1 ? 1 : 2
        updateLightboxScale(targetScale)
    }

    const toggleTag = (tag: string) => {
        setDiaryTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        )
    }

    const handleDiarySave = async () => {
        if (!catId || !user) return
        if (!diaryText.trim() && !diaryImage) return
        setDiarySaving(true)

        try {
            let imageUrl: string | null = diaryImagePreview

            if (diaryImage) {
                const ext = diaryImage.name.split('.').pop()
                const path = `diary/${Date.now()}.${ext}`
                const { error: upErr } = await supabase.storage
                    .from('cat-photos')
                    .upload(path, diaryImage, { upsert: true })
                if (upErr) throw upErr
                const { data: urlData } = supabase.storage.from('cat-photos').getPublicUrl(path)
                imageUrl = urlData.publicUrl
            }

            if (editingDiaryId) {
                await supabase
                    .from('diary_entries')
                    .update({
                        text: diaryText.trim() || null,
                        image_url: imageUrl,
                        tags: diaryTags,
                    })
                    .eq('id', editingDiaryId)
            } else {
                await supabase.from('diary_entries').insert({
                    cat_id: catId,
                    text: diaryText.trim() || null,
                    image_url: imageUrl,
                    tags: diaryTags,
                    created_by: user.id,
                })
            }

            setDiaryOpen(false)
            resetDiaryForm()
            await loadTimeline()
            lightHaptic()
            pushToast('success', editingDiaryId ? '日记已更新 📝' : '日记发布成功 📝')

            // Notify family members on new diary (not edits)
            if (!editingDiaryId && cat) {
                sendDiaryNotification(catId, cat.name).catch(() => {/* silent */ })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '日记发布失败，请稍后重试'))
        } finally {
            setDiarySaving(false)
        }
    }

    const resetDiaryForm = () => {
        setDiaryText('')
        setDiaryTags([])
        setDiaryImage(null)
        if (diaryImagePreview && diaryImagePreview.startsWith('blob:')) {
            URL.revokeObjectURL(diaryImagePreview)
        }
        setDiaryImagePreview(null)
        setEditingDiaryId(null)
    }

    // ─── Add weight ───────────────────────────────
    const handleWeightSave = async () => {
        if (!catId || !user) return
        const kg = parseFloat(weightValue)
        if (isNaN(kg) || kg < 0.1 || kg > 30) {
            setWeightError('体重需在 0.1 到 30kg 之间')
            return
        }
        setWeightError('')
        setWeightSaving(true)

        try {
            if (editingWeightId) {
                await supabase
                    .from('weight_records')
                    .update({ weight_kg: kg })
                    .eq('id', editingWeightId)
            } else {
                await supabase.from('weight_records').insert({
                    cat_id: catId,
                    weight_kg: kg,
                    recorded_at: new Date().toISOString(),
                    created_by: user.id,
                })
            }
            setWeightOpen(false)
            setWeightValue('')
            setEditingWeightId(null)
            await loadTimeline()
            lightHaptic()
            pushToast('success', editingWeightId ? '体重已更新 ⚖️' : '体重记录成功 ⚖️')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '体重记录失败，请稍后重试'))
        } finally {
            setWeightSaving(false)
        }
    }

    const openEditDiary = (entry: DiaryEntry) => {
        setEditingDiaryId(entry.id)
        setDiaryText(entry.text || '')
        setDiaryTags(entry.tags)
        setDiaryImage(null)
        setDiaryImagePreview(entry.image_url)
        setDiaryOpen(true)
    }

    const openEditWeight = (entry: WeightRecord) => {
        setEditingWeightId(entry.id)
        setWeightValue(String(entry.weight_kg))
        setWeightOpen(true)
    }

    const openEditPoop = (entry: PoopLog) => {
        setEditingPoopId(entry.id)
        setPoopBristol(entry.bristol_type)
        setPoopColor(entry.color)
        setPoopOpen(true)
    }

    const handlePoopSave = async () => {
        if (!editingPoopId) return
        setPoopSaving(true)
        try {
            await supabase
                .from('poop_logs')
                .update({ bristol_type: poopBristol, color: poopColor })
                .eq('id', editingPoopId)

            setPoopOpen(false)
            setEditingPoopId(null)
            await loadTimeline()
            lightHaptic()
            pushToast('success', '便便记录已更新 💩')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '更新失败，请稍后重试'))
        } finally {
            setPoopSaving(false)
        }
    }

    const deleteTimelineItem = async (item: TimelineItem) => {
        setDeleteSubmitting(true)
        try {
            if (item.type === 'diary') {
                await supabase.from('diary_entries').delete().eq('id', item.data.id)
            }
            if (item.type === 'poop') {
                await supabase.from('poop_logs').delete().eq('id', item.data.id)
            }
            if (item.type === 'weight') {
                await supabase.from('weight_records').delete().eq('id', item.data.id)
            }
            lightHaptic()
            pushToast('success', '记录已删除')
            await loadTimeline()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除失败，请稍后重试'))
        } finally {
            setDeleteSubmitting(false)
            setPendingDeleteItem(null)
        }
    }

    const filteredTimeline = useMemo(() => {
        const startTs = dateStart ? new Date(`${dateStart}T00:00:00`).getTime() : null
        const endTs = dateEnd ? new Date(`${dateEnd}T23:59:59.999`).getTime() : null
        const normalizedKeyword = deferredKeyword.trim().toLowerCase()

        return timeline.filter((item) => {
            if (!filterTypes.includes(item.type)) return false
            const ts = new Date(item.time).getTime()
            if (startTs !== null && ts < startTs) return false
            if (endTs !== null && ts > endTs) return false

            if (!normalizedKeyword) return true

            if (item.type === 'diary') {
                const text = `${item.data.text || ''} ${(item.data.tags || []).join(' ')}`.toLowerCase()
                return text.includes(normalizedKeyword)
            }
            if (item.type === 'poop') {
                return `便便 ${item.data.bristol_type} ${item.data.color}`.toLowerCase().includes(normalizedKeyword)
            }
            if (item.type === 'weight') {
                return `体重 ${item.data.weight_kg}`.toLowerCase().includes(normalizedKeyword)
            }
            return false
        })
    }, [dateEnd, dateStart, filterTypes, deferredKeyword, timeline])

    const toggleTypeFilter = (type: TimelineItem['type']) => {
        setFilterTypes((prev) => {
            if (prev.includes(type)) {
                if (prev.length === 1) return prev
                return prev.filter((item) => item !== type)
            }
            return [...prev, type]
        })
    }

    const handleDateStartChange = (value: string) => {
        setDateStart(value)
        if (dateEnd && value && dateEnd < value) {
            setDateEnd(value)
        }
    }

    const handleDateEndChange = (value: string) => {
        if (dateStart && value && value < dateStart) {
            pushToast('error', '结束日期必须晚于或等于开始日期')
            setDateEnd(dateStart)
            return
        }
        setDateEnd(value)
    }

    const clearDateFilter = () => {
        setDateStart('')
        setDateEnd('')
    }

    const handleLoadMore = async () => {
        if (loadingMore) return
        const nextLimit = loadLimit + 50
        setLoadingMore(true)
        setLoadLimit(nextLimit)
        await loadTimeline(nextLimit)
        setLoadingMore(false)
    }

    const handleRefresh = async () => {
        await loadTimeline()
    }

    // ─── Virtual list ─────────────────────────────
    const timelineParentRef = useRef<HTMLDivElement>(null)
    const virtualizer = useVirtualizer({
        count: filteredTimeline.length,
        getScrollElement: () => timelineParentRef.current,
        estimateSize: () => 120,
        overscan: 5,
    })

    const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        if (window.scrollY > 0) return
        pullStartYRef.current = event.touches[0].clientY
    }

    const onTouchMovePage = (event: React.TouchEvent<HTMLDivElement>) => {
        if (pullStartYRef.current === null) return
        const delta = event.touches[0].clientY - pullStartYRef.current
        if (delta > 0) {
            setPullDistance(Math.min(delta, 90))
        }
    }

    const onTouchEndPage = async () => {
        if (pullDistance >= 72) {
            await handleRefresh()
        }
        setPullDistance(0)
        pullStartYRef.current = null
    }

    useEffect(() => {
        if (!imageLightbox) return

        lightboxRef.current?.focus()

        const onKeyDown = (event: KeyboardEvent) => {
            if (!imageLightbox) return
            if (event.key === 'Escape') {
                event.preventDefault()
                closeLightbox()
            }
            if (event.key === 'Tab') {
                const focusable = lightboxRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
                if (!focusable || focusable.length === 0) return
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                const active = document.activeElement
                if (event.shiftKey && active === first) {
                    event.preventDefault()
                    last.focus()
                } else if (!event.shiftKey && active === last) {
                    event.preventDefault()
                    first.focus()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [imageLightbox])

    // ─── Helpers ──────────────────────────────────
    const bristolLabels = BRISTOL_LABELS

    const colorEmojis = POOP_COLOR_EMOJIS

    const renderItem = (item: TimelineItem) => {
        switch (item.type) {
            case 'diary': {
                const diaryText = item.data.text || ''
                const isLong = diaryText.length > DIARY_CHAR_LIMIT
                const isExpanded = expandedDiaries.has(item.data.id)
                const displayText = isLong && !isExpanded ? diaryText.slice(0, DIARY_CHAR_LIMIT) + '...' : diaryText
                const isAuthor = user?.id === item.data.created_by
                const reactions = diaryReactions[item.data.id] || []
                const comments = diaryComments[item.data.id] || []
                const commentsVisible = showComments.has(item.data.id)

                // Group reactions by emoji
                const reactionCounts: Record<string, { count: number; userReacted: boolean }> = {}
                reactions.forEach((r) => {
                    if (!reactionCounts[r.emoji]) reactionCounts[r.emoji] = { count: 0, userReacted: false }
                    reactionCounts[r.emoji].count += 1
                    if (r.user_id === user?.id) reactionCounts[r.emoji].userReacted = true
                })

                return (
                    <SwipeableRow key={`d-${item.data.id}`} onDelete={isAuthor ? () => setPendingDeleteItem(item) : undefined}>
                        <Card variant="default" padding="md" className="timeline-card diary-card-full">
                            <div className="timeline-badge diary-badge">📝</div>
                            <div className="timeline-content">
                                {isAuthor && (
                                    <div className="timeline-actions">
                                        <button className="timeline-action-btn" onClick={() => openEditDiary(item.data)}>编辑</button>
                                    </div>
                                )}
                                {item.data.image_url && (
                                    <button className="timeline-img-btn" onClick={() => openLightbox(item.data.image_url)}>
                                        <img src={item.data.image_url} alt="" className="timeline-img" loading="lazy" />
                                    </button>
                                )}
                                <p className="text-sm diary-text-content">{displayText}</p>
                                {isLong && (
                                    <button className="diary-expand-btn" onClick={() => toggleDiaryExpand(item.data.id)}>
                                        {isExpanded ? '收起 ▲' : '展开全文 ▼'}
                                    </button>
                                )}
                                {item.data.tags.length > 0 && (
                                    <div className="timeline-tags">
                                        {item.data.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                                    </div>
                                )}
                                <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>

                                {/* Reactions */}
                                <div className="diary-reactions-row">
                                    {REACTION_EMOJIS.map((emoji) => {
                                        const info = reactionCounts[emoji]
                                        return (
                                            <button
                                                key={emoji}
                                                className={`diary-reaction-btn ${info?.userReacted ? 'diary-reaction-active' : ''}`}
                                                onClick={() => handleToggleReaction(item.data.id, emoji)}
                                            >
                                                {emoji}{info?.count ? ` ${info.count}` : ''}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Comments toggle */}
                                <button className="diary-comment-toggle" onClick={() => toggleShowComments(item.data.id)}>
                                    💬 {comments.length > 0 ? `${comments.length} 条评论` : '评论'}
                                    {commentsVisible ? ' ▲' : ' ▼'}
                                </button>

                                {commentsVisible && (
                                    <div className="diary-comments-section">
                                        {comments.map((c) => (
                                            <div key={c.id} className="diary-comment-item">
                                                <span className="text-xs text-muted">{format(new Date(c.created_at), 'MM/dd HH:mm')}</span>
                                                <span className="text-sm">{c.text}</span>
                                                {c.user_id === user?.id && (
                                                    <button className="diary-comment-delete" onClick={() => handleDeleteComment(c.id, item.data.id)}>✕</button>
                                                )}
                                            </div>
                                        ))}
                                        <div className="diary-comment-input-row">
                                            <input
                                                type="text"
                                                className="form-input diary-comment-input"
                                                placeholder="写评论..."
                                                value={commentInputs[item.data.id] || ''}
                                                onChange={(e) => setCommentInputs((prev) => ({ ...prev, [item.data.id]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        handleAddComment(item.data.id)
                                                    }
                                                }}
                                            />
                                            <button
                                                className="diary-comment-send"
                                                onClick={() => handleAddComment(item.data.id)}
                                                disabled={commentSaving === item.data.id}
                                            >
                                                {commentSaving === item.data.id ? '...' : '发送'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </SwipeableRow>
                )
            }
            case 'poop': {
                const abnormal = isAbnormalPoop(item.data.bristol_type, item.data.color)
                return (
                    <SwipeableRow key={`p-${item.data.id}`} onDelete={() => setPendingDeleteItem(item)}>
                        <Card variant="default" padding="md" className={`timeline-card ${abnormal ? 'timeline-warn' : ''}`}>
                            <div className="timeline-badge poop-badge">💩</div>
                            <div className="timeline-content">
                                <div className="timeline-actions">
                                    <button className="timeline-action-btn" onClick={() => openEditPoop(item.data)}>编辑</button>
                                </div>
                                <p className="text-sm">
                                    布里斯托 {item.data.bristol_type} 型 · {bristolLabels[item.data.bristol_type]}
                                    {' '}{colorEmojis[item.data.color]}
                                    {abnormal && <span className="warn-tag">⚠️ 异常</span>}
                                </p>
                                <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>
                            </div>
                        </Card>
                    </SwipeableRow>
                )
            }
            case 'weight':
                return (
                    <SwipeableRow key={`w-${item.data.id}`} onDelete={() => setPendingDeleteItem(item)}>
                        <Card variant="default" padding="md" className="timeline-card">
                            <div className="timeline-badge weight-badge">⚖️</div>
                            <div className="timeline-content">
                                <div className="timeline-actions">
                                    <button className="timeline-action-btn" onClick={() => openEditWeight(item.data)}>编辑</button>
                                </div>
                                <p className="text-sm font-semibold">{item.data.weight_kg} kg</p>
                                <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>
                            </div>
                        </Card>
                    </SwipeableRow>
                )
        }
    }

    return (
        <div className="log-page fade-in" onTouchStart={onTouchStart} onTouchMove={onTouchMovePage} onTouchEnd={onTouchEndPage}>
            <div className="page-header p-4">
                <h1 className="text-2xl font-bold">📝 记录</h1>
                <p className="text-secondary text-sm">所有猫咪动态</p>
            </div>

            <div className="px-4">
                <Card variant="default" padding="md" className="log-filter-card">
                    <input
                        type="search"
                        className="form-input"
                        placeholder="搜索记录关键字"
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        aria-label="搜索记录"
                    />
                    <div className="timeline-chip-row" role="group" aria-label="记录类型筛选">
                        {([
                            { key: 'diary' as const, label: '📝 日记' },
                            { key: 'poop' as const, label: '💩 便便' },
                            { key: 'weight' as const, label: '⚖️ 体重' },
                        ]).map((item) => (
                            <button
                                key={item.key}
                                className={`timeline-chip ${filterTypes.includes(item.key) ? 'timeline-chip-active' : ''}`}
                                onClick={() => toggleTypeFilter(item.key)}
                                aria-pressed={filterTypes.includes(item.key)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="timeline-date-row">
                        <input
                            type="date"
                            className="form-input"
                            value={dateStart}
                            onChange={(event) => handleDateStartChange(event.target.value)}
                            aria-label="开始日期"
                        />
                        <span className="text-secondary text-sm">至</span>
                        <input
                            type="date"
                            className="form-input"
                            value={dateEnd}
                            onChange={(event) => handleDateEndChange(event.target.value)}
                            min={dateStart || undefined}
                            aria-label="结束日期"
                        />
                        <button type="button" className="timeline-date-reset" onClick={clearDateFilter}>全部</button>
                    </div>
                </Card>
            </div>

            <div className="timeline px-4" ref={timelineParentRef} style={{ overflowY: 'auto', maxHeight: '70vh' }}>
                {loading || catLoading ? (
                    <div className="empty-state">
                        <span className="empty-icon">⏳</span>
                        <p className="text-secondary text-sm">加载中...</p>
                    </div>
                ) : filteredTimeline.length === 0 ? (
                    <div className="empty-state">
                        <EmptyCatIllustration mood="play" />
                        <p className="text-secondary text-sm">没有符合筛选条件的记录</p>
                    </div>
                ) : (
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const item = filteredTimeline[virtualRow.index]
                            return (
                                <div
                                    key={virtualRow.key}
                                    data-index={virtualRow.index}
                                    ref={virtualizer.measureElement}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    {renderItem(item)}
                                </div>
                            )
                        })}
                    </div>
                )}

                {!loading && hasMore && (
                    <Button variant="secondary" onClick={handleLoadMore} disabled={loadingMore}>
                        {loadingMore ? '加载中...' : '加载更多'}
                    </Button>
                )}
            </div>

            {/* Diary Modal */}
            <Modal isOpen={diaryOpen} onClose={() => { setDiaryOpen(false); resetDiaryForm() }} title={editingDiaryId ? '📝 编辑日记' : '📝 写日记'}>
                <div className="diary-form">
                    <div className="form-group">
                        <textarea
                            className="form-input diary-textarea"
                            placeholder="今天猫咪做了什么..."
                            value={diaryText}
                            onChange={(e) => setDiaryText(e.target.value)}
                            maxLength={500}
                            rows={4}
                        />
                        <p className="text-muted text-xs">{diaryText.length}/500</p>
                    </div>

                    <div className="form-group">
                        <label className="form-label">标签</label>
                        <div className="tag-picker">
                            {TAGS.map((tag) => (
                                <button
                                    key={tag}
                                    className={`tag-btn ${diaryTags.includes(tag) ? 'tag-btn-active' : ''}`}
                                    onClick={() => toggleTag(tag)}
                                >
                                    #{tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">照片</label>
                        {diaryImagePreview ? (
                            <div className="image-preview-container">
                                <img src={diaryImagePreview} alt="" className="image-preview" loading="lazy" />
                                <button className="image-remove" onClick={() => { setDiaryImage(null); setDiaryImagePreview(null) }}>✕</button>
                            </div>
                        ) : (
                            <button className="photo-upload-btn" onClick={() => fileInputRef.current?.click()}>
                                📷 选择照片
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
                        {diarySaving ? '保存中...' : editingDiaryId ? '保存修改' : '发布 🐾'}
                    </Button>
                </div>
            </Modal>

            {/* Weight Modal */}
            <Modal isOpen={weightOpen} onClose={() => { setWeightOpen(false); setEditingWeightId(null); setWeightValue(''); setWeightError('') }} title={editingWeightId ? '⚖️ 编辑体重' : '⚖️ 记录体重'}>
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label">体重 (kg)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0.1"
                            max="30"
                            className="form-input weight-input"
                            value={weightValue}
                            onChange={(e) => {
                                setWeightValue(e.target.value)
                                setWeightError('')
                            }}
                            autoFocus
                            aria-invalid={weightError ? true : undefined}
                            aria-describedby={weightError ? 'weight-error' : undefined}
                        />
                        {weightError && <p className="text-xs text-danger" id="weight-error">{weightError}</p>}
                    </div>
                    <Button variant="primary" fullWidth onClick={handleWeightSave} disabled={weightSaving || !online}>
                        {weightSaving ? '保存中...' : editingWeightId ? '更新体重' : '保存体重'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={poopOpen} onClose={() => { setPoopOpen(false); setEditingPoopId(null) }} title="💩 编辑便便记录">
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label">布里斯托类型</label>
                        <select
                            className="form-input"
                            value={poopBristol}
                            onChange={(e) => setPoopBristol(e.target.value as '1' | '2' | '3' | '4' | '5' | '6' | '7')}
                        >
                            {(['1', '2', '3', '4', '5', '6', '7'] as const).map((type) => (
                                <option key={type} value={type}>类型 {type} · {bristolLabels[type]}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">颜色</label>
                        <select
                            className="form-input"
                            value={poopColor}
                            onChange={(e) => setPoopColor(e.target.value as 'brown' | 'dark_brown' | 'yellow' | 'green' | 'red' | 'black' | 'white')}
                        >
                            {([
                                { value: 'brown', label: '棕色' },
                                { value: 'dark_brown', label: '深棕色' },
                                { value: 'yellow', label: '黄色' },
                                { value: 'green', label: '绿色' },
                                { value: 'red', label: '红色' },
                                { value: 'black', label: '黑色' },
                                { value: 'white', label: '白色' },
                            ] as const).map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <Button variant="primary" fullWidth onClick={handlePoopSave} disabled={poopSaving || !online}>
                        {poopSaving ? '保存中...' : '更新便便记录'}
                    </Button>
                </div>
            </Modal>

            {imageLightbox && (
                <div
                    className="lightbox-overlay"
                    onClick={closeLightbox}
                    ref={lightboxRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="图片预览"
                    tabIndex={-1}
                >
                    <div className="lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
                        <button className="lightbox-btn" onClick={() => updateLightboxScale(lightboxScale - 0.2)}>-</button>
                        <span className="lightbox-scale">{Math.round(lightboxScale * 100)}%</span>
                        <button className="lightbox-btn" onClick={() => updateLightboxScale(lightboxScale + 0.2)}>+</button>
                        <button className="lightbox-btn" onClick={() => updateLightboxScale(1)}>重置</button>
                        <button className="lightbox-btn" onClick={closeLightbox}>关闭</button>
                    </div>
                    <div
                        className="lightbox-stage"
                        onClick={(event) => event.stopPropagation()}
                        onTouchStart={onLightboxTouchStart}
                        onTouchMove={onLightboxTouchMove}
                        onTouchEnd={onLightboxTouchEnd}
                        onPointerDown={onLightboxPointerDown}
                        onPointerMove={onLightboxPointerMove}
                        onPointerUp={onLightboxPointerUp}
                        onPointerCancel={onLightboxPointerUp}
                        onDoubleClick={onLightboxDoubleClick}
                    >
                        <img
                            src={imageLightbox}
                            alt="日记图片预览"
                            className="lightbox-image"
                            style={{
                                transform: `translate(${lightboxOffset.x}px, ${lightboxOffset.y}px) scale(${lightboxScale})`,
                                cursor: lightboxScale > 1 ? (lightboxDragging ? 'grabbing' : 'grab') : 'zoom-in',
                            }}
                        />
                    </div>
                </div>
            )}

            <Modal isOpen={Boolean(pendingDeleteItem)} onClose={() => setPendingDeleteItem(null)} title="确认删除？">
                <div className="weight-form">
                    <p className="text-sm text-secondary">此操作不可恢复，确认删除这条记录吗？</p>
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={() => pendingDeleteItem && deleteTimelineItem(pendingDeleteItem)}
                        disabled={deleteSubmitting}
                    >
                        {deleteSubmitting ? '删除中...' : '确认删除'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
