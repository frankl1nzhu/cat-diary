import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { FAB } from '../components/ui/FAB'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { useRealtimeSubscription } from '../lib/realtime'
import { getErrorMessage } from '../lib/errorMessage'
import { format } from 'date-fns'
import type { DiaryEntry, PoopLog, WeightRecord, MoodLog } from '../types/database.types'
import './LogPage.css'

type TimelineItem =
    | { type: 'diary'; data: DiaryEntry; time: string }
    | { type: 'poop'; data: PoopLog; time: string }
    | { type: 'weight'; data: WeightRecord; time: string }
    | { type: 'mood'; data: MoodLog; time: string }

const TAGS = ['睡觉', '干饭', '捣乱', '便便', '玩耍', '撒娇']

export function LogPage() {
    const { user } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)

    const [timeline, setTimeline] = useState<TimelineItem[]>([])
    const [loading, setLoading] = useState(true)

    // New diary modal
    const [diaryOpen, setDiaryOpen] = useState(false)
    const [diaryText, setDiaryText] = useState('')
    const [diaryTags, setDiaryTags] = useState<string[]>([])
    const [diaryImage, setDiaryImage] = useState<File | null>(null)
    const [diaryImagePreview, setDiaryImagePreview] = useState<string | null>(null)
    const [diarySaving, setDiarySaving] = useState(false)

    // New weight modal
    const [weightOpen, setWeightOpen] = useState(false)
    const [weightValue, setWeightValue] = useState('')
    const [weightSaving, setWeightSaving] = useState(false)

    // FAB menu
    const [fabMenuOpen, setFabMenuOpen] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // ─── Load timeline ────────────────────────────
    const loadTimeline = useCallback(async () => {
        let catId = currentCatId
        if (!catId) {
            const { data: catData } = await supabase
                .from('cats')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()
            if (catData) {
                catId = catData.id
                setCurrentCatId(catId)
            }
        }
        if (!catId) { setLoading(false); return }

        const [diaries, poops, weights, moods] = await Promise.all([
            supabase.from('diary_entries').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(50),
            supabase.from('poop_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(50),
            supabase.from('weight_records').select('*').eq('cat_id', catId).order('recorded_at', { ascending: false }).limit(50),
            supabase.from('mood_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(50),
        ])

        const items: TimelineItem[] = []
        diaries.data?.forEach((d) => items.push({ type: 'diary', data: d, time: d.created_at }))
        poops.data?.forEach((p) => items.push({ type: 'poop', data: p, time: p.created_at }))
        weights.data?.forEach((w) => items.push({ type: 'weight', data: w, time: w.recorded_at }))
        moods.data?.forEach((m) => items.push({ type: 'mood', data: m, time: m.created_at }))

        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setTimeline(items)
        setLoading(false)
    }, [currentCatId, setCurrentCatId])

    useEffect(() => { loadTimeline() }, [loadTimeline])

    useRealtimeSubscription('diary_entries', () => loadTimeline(),
        currentCatId ? `cat_id=eq.${currentCatId}` : undefined)

    // ─── Add diary ────────────────────────────────
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setDiaryImage(file)
        setDiaryImagePreview(URL.createObjectURL(file))
    }

    const toggleTag = (tag: string) => {
        setDiaryTags((prev) =>
            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
        )
    }

    const handleDiarySave = async () => {
        if (!currentCatId || !user) return
        if (!diaryText.trim() && !diaryImage) return
        setDiarySaving(true)

        try {
            let imageUrl: string | null = null

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

            await supabase.from('diary_entries').insert({
                cat_id: currentCatId,
                text: diaryText.trim() || null,
                image_url: imageUrl,
                tags: diaryTags,
                created_by: user.id,
            })

            setDiaryOpen(false)
            resetDiaryForm()
            await loadTimeline()
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
        setDiaryImagePreview(null)
    }

    // ─── Add weight ───────────────────────────────
    const handleWeightSave = async () => {
        if (!currentCatId || !user) return
        const kg = parseFloat(weightValue)
        if (isNaN(kg) || kg <= 0) return
        setWeightSaving(true)

        try {
            await supabase.from('weight_records').insert({
                cat_id: currentCatId,
                weight_kg: kg,
                recorded_at: new Date().toISOString(),
                created_by: user.id,
            })
            setWeightOpen(false)
            setWeightValue('')
            await loadTimeline()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '体重记录失败，请稍后重试'))
        } finally {
            setWeightSaving(false)
        }
    }

    // ─── Helpers ──────────────────────────────────
    const bristolLabels: Record<string, string> = {
        '1': '硬球状', '2': '腊肠状硬块', '3': '腊肠状裂纹',
        '4': '软条状', '5': '软团状', '6': '泥状', '7': '水状',
    }

    const colorEmojis: Record<string, string> = {
        brown: '🟫', dark_brown: '⬛', yellow: '🟨',
        green: '🟩', red: '🟥', black: '⬛', white: '⬜',
    }

    const renderItem = (item: TimelineItem) => {
        switch (item.type) {
            case 'diary':
                return (
                    <Card key={`d-${item.data.id}`} variant="default" padding="md" className="timeline-card">
                        <div className="timeline-badge diary-badge">📝</div>
                        <div className="timeline-content">
                            {item.data.image_url && (
                                <img src={item.data.image_url} alt="" className="timeline-img" />
                            )}
                            <p className="text-sm">{item.data.text || ''}</p>
                            {item.data.tags.length > 0 && (
                                <div className="timeline-tags">
                                    {item.data.tags.map((t) => <span key={t} className="tag">#{t}</span>)}
                                </div>
                            )}
                            <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>
                        </div>
                    </Card>
                )
            case 'poop': {
                const isAbnormal = Number(item.data.bristol_type) >= 6 || ['red', 'black', 'white'].includes(item.data.color)
                return (
                    <Card key={`p-${item.data.id}`} variant="default" padding="md" className={`timeline-card ${isAbnormal ? 'timeline-warn' : ''}`}>
                        <div className="timeline-badge poop-badge">💩</div>
                        <div className="timeline-content">
                            <p className="text-sm">
                                布里斯托 {item.data.bristol_type} 型 · {bristolLabels[String(item.data.bristol_type)]}
                                {' '}{colorEmojis[item.data.color]}
                                {isAbnormal && <span className="warn-tag">⚠️ 异常</span>}
                            </p>
                            <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>
                        </div>
                    </Card>
                )
            }
            case 'weight':
                return (
                    <Card key={`w-${item.data.id}`} variant="default" padding="md" className="timeline-card">
                        <div className="timeline-badge weight-badge">⚖️</div>
                        <div className="timeline-content">
                            <p className="text-sm font-semibold">{item.data.weight_kg} kg</p>
                            <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd HH:mm')}</span>
                        </div>
                    </Card>
                )
            case 'mood':
                return (
                    <Card key={`m-${item.data.id}`} variant="default" padding="md" className="timeline-card">
                        <div className="timeline-badge mood-badge">{item.data.mood}</div>
                        <div className="timeline-content">
                            <p className="text-sm">今日心情 {item.data.mood}</p>
                            <span className="text-muted text-xs">{format(new Date(item.time), 'MM/dd')}</span>
                        </div>
                    </Card>
                )
        }
    }

    return (
        <div className="log-page fade-in">
            <div className="page-header p-4">
                <h1 className="text-2xl font-bold">📝 记录</h1>
                <p className="text-secondary text-sm">所有猫咪动态</p>
            </div>

            <div className="timeline px-4">
                {loading ? (
                    <div className="empty-state">
                        <span className="empty-icon">⏳</span>
                        <p className="text-secondary text-sm">加载中...</p>
                    </div>
                ) : timeline.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📸</span>
                        <p className="text-secondary text-sm">还没有记录，点右下角 + 开始吧！</p>
                    </div>
                ) : (
                    timeline.map(renderItem)
                )}
            </div>

            {/* FAB Menu */}
            <div className="fab-container">
                {fabMenuOpen && (
                    <div className="fab-menu fade-in">
                        <button className="fab-option" onClick={() => { setDiaryOpen(true); setFabMenuOpen(false) }}>
                            📝 写日记
                        </button>
                        <button className="fab-option" onClick={() => { setWeightOpen(true); setFabMenuOpen(false) }}>
                            ⚖️ 记体重
                        </button>
                    </div>
                )}
                <FAB icon="＋" onClick={() => setFabMenuOpen(!fabMenuOpen)} />
            </div>

            {/* Diary Modal */}
            <Modal isOpen={diaryOpen} onClose={() => { setDiaryOpen(false); resetDiaryForm() }} title="📝 写日记">
                <div className="diary-form">
                    <div className="form-group">
                        <textarea
                            className="form-input diary-textarea"
                            placeholder="今天猫咪做了什么..."
                            value={diaryText}
                            onChange={(e) => setDiaryText(e.target.value)}
                            rows={4}
                        />
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
                                <img src={diaryImagePreview} alt="" className="image-preview" />
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

                    <Button variant="primary" fullWidth onClick={handleDiarySave} disabled={diarySaving}>
                        {diarySaving ? '发布中...' : '发布 🐾'}
                    </Button>
                </div>
            </Modal>

            {/* Weight Modal */}
            <Modal isOpen={weightOpen} onClose={() => setWeightOpen(false)} title="⚖️ 记录体重">
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label">体重 (kg)</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input weight-input"
                            placeholder="4.50"
                            value={weightValue}
                            onChange={(e) => setWeightValue(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <Button variant="primary" fullWidth onClick={handleWeightSave} disabled={weightSaving}>
                        {weightSaving ? '记录中...' : '保存体重'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
