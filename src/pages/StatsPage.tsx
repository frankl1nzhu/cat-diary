import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { RenewModal } from '../components/ui/RenewModal'
import { SwipeableRow } from '../components/ui/SwipeableRow'
import { EmptyCatIllustration } from '../components/ui/EmptyCatIllustration'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { lightHaptic } from '../lib/haptics'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { useRenewForm } from '../lib/useRenewForm'
import { sendHealthNotification, sendInventoryNotification, sendWeightNotification } from '../lib/pushServer'
import { isAbnormalPoop, INVENTORY_ICONS } from '../lib/constants'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import type { WeightRecord, HealthRecord, InventoryItem, InventoryStatus, PoopLog, MissLog, FeedStatus, DiaryEntry, MoodLog } from '../types/database.types'
import { computeDaysRemaining, computeInventoryStatus } from '../types/database.types'
import './StatsPage.css'

type HealthFormType = 'vaccine' | 'deworming' | 'medical' | 'vomit'
type ExportTypeKey = 'weight' | 'poop' | 'miss' | 'health' | 'inventory' | 'diary' | 'mood' | 'feed'

/** Escape HTML special characters to prevent XSS in exported reports. */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/** Health type labels (module-level constant to avoid re-creation). */
const HEALTH_TYPE_LABELS: Record<HealthFormType, { icon: string; label: string }> = {
    vaccine: { icon: '💉', label: '疫苗' },
    deworming: { icon: '💊', label: '驱虫' },
    medical: { icon: '🏥', label: '就医' },
    vomit: { icon: '🤮', label: '呕吐' },
}

/** Pie chart colors (module-level constant). */
const PIE_COLORS = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-accent)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-primary-dark)']

export function StatsPage() {
    const { user } = useSession()
    const { cat, catId, loading: catLoading } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)
    const online = useOnlineStatus()
    const [searchParams, setSearchParams] = useSearchParams()

    const [weights, setWeights] = useState<WeightRecord[]>([])
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [poops, setPoops] = useState<PoopLog[]>([])
    const [missLogs, setMissLogs] = useState<MissLog[]>([])
    const [feeds, setFeeds] = useState<FeedStatus[]>([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [healthModalOpen, setHealthModalOpen] = useState(false)
    const [healthType, setHealthType] = useState<HealthFormType>('vaccine')
    const [healthName, setHealthName] = useState('')
    const [healthDate, setHealthDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [healthNextDue, setHealthNextDue] = useState('')
    const [healthMedicalPreset, setHealthMedicalPreset] = useState<'vomit' | 'cough' | 'fever' | 'other'>('vomit')
    const [healthNotes, setHealthNotes] = useState('')
    const [editingHealthId, setEditingHealthId] = useState<string | null>(null)
    const [healthSaving, setHealthSaving] = useState(false)

    // Renew modal (vaccine / deworming) — shared hook
    // Use arrow wrapper to avoid forward-reference of loadData
    const renew = useRenewForm({ catId, onSuccess: () => loadData() })

    const [inventoryModalOpen, setInventoryModalOpen] = useState(false)
    const [invItemName, setInvItemName] = useState('')
    const [invIcon, setInvIcon] = useState<string | null>(null)
    const [invTotalQty, setInvTotalQty] = useState('')
    const [invDailyConsumption, setInvDailyConsumption] = useState('')
    const [editingInvId, setEditingInvId] = useState<string | null>(null)
    const [invSaving, setInvSaving] = useState(false)

    const [weightModalOpen, setWeightModalOpen] = useState(false)
    const [weightValue, setWeightValue] = useState('')
    const [weightDate, setWeightDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [weightWindowDays, setWeightWindowDays] = useState(30)
    const [feedWindowDays, setFeedWindowDays] = useState(30)
    const [missWindowDays, setMissWindowDays] = useState(30)
    const [weightError, setWeightError] = useState('')
    const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
    const [weightSaving, setWeightSaving] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<{ id: string; type: 'health' | 'inventory' | 'weight' } | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)
    const [exportModalOpen, setExportModalOpen] = useState(false)
    const [exportDays, setExportDays] = useState(30)
    const [exporting, setExporting] = useState(false)
    const [exportTypes, setExportTypes] = useState<Record<ExportTypeKey, boolean>>({
        weight: true,
        poop: true,
        miss: true,
        health: true,
        inventory: true,
        diary: true,
        mood: true,
        feed: true,
    })

    const maxExportDays = useMemo(() => {
        if (!cat?.created_at) return 1
        const created = new Date(cat.created_at)
        const now = new Date()
        created.setHours(0, 0, 0, 0)
        now.setHours(0, 0, 0, 0)
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)) + 1
        return Math.max(1, diffDays)
    }, [cat?.created_at])

    useEffect(() => {
        setExportDays((prev) => Math.min(Math.max(prev, 1), maxExportDays))
    }, [maxExportDays])

    // ─── Quick-open from URL params ───────────────
    useEffect(() => {
        const quick = searchParams.get('quick')
        if (!quick || loading) return
        if (quick === 'inventory') {
            setInventoryModalOpen(true)
            setSearchParams({}, { replace: true })
        } else if (quick === 'health') {
            setHealthModalOpen(true)
            setSearchParams({}, { replace: true })
        }
    }, [searchParams, setSearchParams, loading])

    // ─── Load data ────────────────────────────────
    const loadData = useCallback(async () => {
        if (!catId) {
            if (!catLoading) setLoading(false)
            return
        }

        try {
            const [w, h, inv, poopData, missData, feedData] = await Promise.all([
                supabase.from('weight_records').select('*').eq('cat_id', catId).order('recorded_at', { ascending: true }),
                supabase.from('health_records').select('*').eq('cat_id', catId).order('date', { ascending: false }),
                supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true }),
                supabase.from('poop_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(120),
                supabase.from('miss_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(200),
                supabase.from('feed_status').select('*').eq('cat_id', catId).order('fed_at', { ascending: false }).limit(400),
            ])

            if (w.data) setWeights(w.data)
            if (h.data) setHealthRecords(h.data)
            if (inv.data) setInventory(inv.data)
            if (poopData.data) setPoops(poopData.data)
            if (missData.data) setMissLogs(missData.data)
            if (feedData.data) setFeeds(feedData.data)
        } catch (err) {
            console.error('Failed to load stats data:', err)
            pushToast('error', getErrorMessage(err, '统计数据加载失败，请稍后重试'))
        } finally {
            setLoading(false)
        }
    }, [catId, catLoading, pushToast])

    useEffect(() => { loadData() }, [loadData])

    // ─── Weight chart data (memoized) ───────────────
    const chartData = useMemo(() => {
        const cutoff = Date.now() - (weightWindowDays - 1) * 24 * 60 * 60 * 1000
        return weights
            .filter((w) => new Date(w.recorded_at).getTime() >= cutoff)
            .map((w) => ({
                date: format(new Date(w.recorded_at), 'MM/dd'),
                weight: w.weight_kg,
            }))
    }, [weightWindowDays, weights])

    const bristolDistributionData = useMemo(() => {
        const counts = { 正常: 0, 异常: 0 }
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        poops.forEach((item) => {
            if (new Date(item.created_at).getTime() >= cutoff) {
                if (isAbnormalPoop(item.bristol_type, item.color)) {
                    counts.异常 += 1
                } else {
                    counts.正常 += 1
                }
            }
        })

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .filter((item) => item.value > 0)
    }, [poops])

    const missTrendData = useMemo(() => {
        const dayMap = new Map<string, number>()
        for (let i = missWindowDays - 1; i >= 0; i -= 1) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = format(d, 'MM/dd')
            dayMap.set(key, 0)
        }

        missLogs.forEach((item) => {
            const key = format(new Date(item.created_at), 'MM/dd')
            if (dayMap.has(key)) {
                dayMap.set(key, (dayMap.get(key) || 0) + 1)
            }
        })

        return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))
    }, [missLogs, missWindowDays])

    const feedTrendData = useMemo(() => {
        const dayMap = new Map<string, number>()
        for (let i = feedWindowDays - 1; i >= 0; i -= 1) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = format(d, 'MM/dd')
            dayMap.set(key, 0)
        }

        feeds.forEach((item) => {
            const at = item.fed_at || item.updated_at
            const key = format(new Date(at), 'MM/dd')
            if (dayMap.has(key)) {
                dayMap.set(key, (dayMap.get(key) || 0) + 1)
            }
        })

        return Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))
    }, [feeds, feedWindowDays])

    const handleToggleExportType = (key: ExportTypeKey) => {
        setExportTypes((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const exportSelectedRecords = async () => {
        if (!catId) return
        const selectedTypes = (Object.keys(exportTypes) as ExportTypeKey[]).filter((k) => exportTypes[k])
        if (selectedTypes.length === 0) {
            pushToast('error', '请至少选择一种导出类型')
            return
        }

        const cutoff = Date.now() - (exportDays - 1) * 24 * 60 * 60 * 1000
        const cutoffIso = new Date(cutoff).toISOString()
        setExporting(true)

        try {
            const [weightsRes, poopsRes, missesRes, healthRes, invRes, diaryRes, moodRes, feedRes] = await Promise.all([
                exportTypes.weight
                    ? supabase.from('weight_records').select('*').eq('cat_id', catId).gte('recorded_at', cutoffIso).order('recorded_at', { ascending: true })
                    : Promise.resolve({ data: [] as WeightRecord[], error: null }),
                exportTypes.poop
                    ? supabase.from('poop_logs').select('*').eq('cat_id', catId).gte('created_at', cutoffIso).order('created_at', { ascending: true })
                    : Promise.resolve({ data: [] as PoopLog[], error: null }),
                exportTypes.miss
                    ? supabase.from('miss_logs').select('*').eq('cat_id', catId).gte('created_at', cutoffIso).order('created_at', { ascending: true })
                    : Promise.resolve({ data: [] as MissLog[], error: null }),
                exportTypes.health
                    ? supabase.from('health_records').select('*').eq('cat_id', catId).gte('date', format(new Date(cutoff), 'yyyy-MM-dd')).order('date', { ascending: true })
                    : Promise.resolve({ data: [] as HealthRecord[], error: null }),
                exportTypes.inventory
                    ? supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true })
                    : Promise.resolve({ data: [] as InventoryItem[], error: null }),
                exportTypes.diary
                    ? supabase.from('diary_entries').select('*').eq('cat_id', catId).gte('created_at', cutoffIso).order('created_at', { ascending: true })
                    : Promise.resolve({ data: [] as DiaryEntry[], error: null }),
                exportTypes.mood
                    ? supabase.from('mood_logs').select('*').eq('cat_id', catId).gte('created_at', cutoffIso).order('created_at', { ascending: true })
                    : Promise.resolve({ data: [] as MoodLog[], error: null }),
                exportTypes.feed
                    ? supabase.from('feed_status').select('*').eq('cat_id', catId).gte('updated_at', cutoffIso).order('updated_at', { ascending: true })
                    : Promise.resolve({ data: [] as FeedStatus[], error: null }),
            ])

            const htmlSections: string[] = []
            if (exportTypes.weight) htmlSections.push(`<h2>⚖️ 体重记录</h2><ul>${(weightsRes.data || []).map((w) => `<li>${escapeHtml(new Date(w.recorded_at).toLocaleString())}: ${escapeHtml(String(w.weight_kg))} kg</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.poop) htmlSections.push(`<h2>💩 便便记录</h2><ul>${(poopsRes.data || []).map((p) => `<li>${escapeHtml(new Date(p.created_at).toLocaleString())}: Bristol ${escapeHtml(String(p.bristol_type))}, ${escapeHtml(p.color)}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.miss) htmlSections.push(`<h2>🥹 咪被想次数</h2><ul>${(missesRes.data || []).map((m) => `<li>${escapeHtml(new Date(m.created_at).toLocaleString())}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.health) htmlSections.push(`<h2>💉 健康记录</h2><ul>${(healthRes.data || []).map((h) => `<li>${escapeHtml(new Date(h.date).toLocaleDateString())}: ${escapeHtml(h.name)} (${escapeHtml(h.type)})${h.notes ? ` - ${escapeHtml(h.notes)}` : ''}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.inventory) htmlSections.push(`<h2>📦 物资库存</h2><ul>${(invRes.data || []).map((i) => `<li>${escapeHtml(i.item_name)}${i.icon ? ` ${escapeHtml(i.icon)}` : ''}: ${escapeHtml(i.status)}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.diary) htmlSections.push(`<h2>📝 日记</h2><ul>${(diaryRes.data || []).map((d) => `<li><div>${escapeHtml(new Date(d.created_at).toLocaleString())}: ${escapeHtml(d.text || '(无文字)')}</div>${d.image_url ? `<div style=\"margin-top:6px;\"><img src=\"${escapeHtml(d.image_url)}\" alt=\"diary image\" style=\"max-width:100%;max-height:360px;object-fit:contain;border-radius:8px;border:1px solid #ddd;\" /></div>` : ''}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.mood) htmlSections.push(`<h2>😺 心情</h2><ul>${(moodRes.data || []).map((m) => `<li>${escapeHtml(m.date)}: ${escapeHtml(m.mood)}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)
            if (exportTypes.feed) htmlSections.push(`<h2>🍽️ 喂食</h2><ul>${(feedRes.data || []).map((f) => `<li>${escapeHtml(new Date(f.fed_at || f.updated_at).toLocaleString())}: ${escapeHtml(f.meal_type)}</li>`).join('') || '<li>暂无记录</li>'}</ul>`)

            const html = `
            <html><head><meta charset="utf-8" /><title>记录导出</title>
            <style>body{font-family:-apple-system;padding:24px;line-height:1.6}h1{margin:0 0 4px}h2{margin:20px 0 8px}ul{padding-left:18px}</style>
            </head><body>
            <h1>🐱 全部记录导出</h1>
            <div>时间跨度：最近 ${exportDays} 天</div>
            ${htmlSections.join('')}
            </body></html>`

            const iframe = document.createElement('iframe')
            iframe.style.position = 'fixed'
            iframe.style.right = '0'
            iframe.style.bottom = '0'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            iframe.setAttribute('aria-hidden', 'true')
            document.body.appendChild(iframe)

            const cleanup = () => setTimeout(() => iframe.remove(), 1500)

            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document
                if (!doc || !iframe.contentWindow) throw new Error('print-frame-unavailable')
                doc.open()
                doc.write(html)
                doc.close()
                const runPrint = () => {
                    iframe.contentWindow?.focus()
                    iframe.contentWindow?.print()
                    cleanup()
                }
                if (doc.readyState === 'complete') runPrint()
                else iframe.onload = runPrint
            } catch {
                cleanup()
                const reportWindow = window.open('', '_blank')
                if (!reportWindow) {
                    pushToast('error', '导出窗口被拦截，请允许弹窗后重试')
                    return
                }
                reportWindow.document.write(html)
                reportWindow.document.close()
                reportWindow.focus()
                reportWindow.print()
            }

            setExportModalOpen(false)
        } catch (err) {
            pushToast('error', getErrorMessage(err, '导出失败，请稍后重试'))
        } finally {
            setExporting(false)
        }
    }

    // ─── Save health record ───────────────────────
    const handleHealthSave = async () => {
        if (!catId || !user || !healthName.trim()) return
        setHealthSaving(true)
        try {
            const payloadType = healthType === 'vomit' ? 'medical' : healthType
            const payloadName = healthType === 'vomit' ? '呕吐' : healthName.trim()
            const payloadNextDue = payloadType === 'medical' ? null : (healthNextDue || null)
            if (editingHealthId) {
                await supabase
                    .from('health_records')
                    .update({
                        type: payloadType,
                        name: payloadName,
                        date: healthDate,
                        next_due: payloadNextDue,
                        notes: healthNotes.trim() || null,
                    })
                    .eq('id', editingHealthId)
            } else {
                await supabase.from('health_records').insert({
                    cat_id: catId,
                    type: payloadType,
                    name: payloadName,
                    date: healthDate,
                    next_due: payloadNextDue,
                    notes: healthNotes.trim() || null,
                    created_by: user.id,
                })
            }
            setHealthModalOpen(false)
            resetHealthForm()
            await loadData()
            lightHaptic()
            pushToast('success', editingHealthId ? '健康记录已更新' : '健康记录已保存')
            if (!editingHealthId && catId) {
                const typeLabel = healthType === 'vomit' ? '呕吐' : healthType === 'vaccine' ? '疫苗' : healthType === 'deworming' ? '驱虫' : '就医'
                sendHealthNotification(catId, cat?.name || '猫咪', typeLabel, payloadName).catch(() => { })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '健康记录保存失败，请稍后重试'))
        } finally {
            setHealthSaving(false)
        }
    }

    const resetHealthForm = () => {
        setHealthName('')
        setHealthDate(format(new Date(), 'yyyy-MM-dd'))
        setHealthNextDue('')
        setHealthMedicalPreset('other')
        setHealthNotes('')
        setHealthType('vaccine')
        setEditingHealthId(null)
    }

    // ─── Save/update inventory ────────────────────
    const handleInventorySave = async () => {
        if (!catId || !user || !invItemName.trim()) return
        const totalQty = invTotalQty ? parseFloat(invTotalQty) : null
        const dailyCons = invDailyConsumption ? parseFloat(invDailyConsumption) : null
        // Compute status from quantity fields
        const fakeItem = { total_quantity: totalQty, daily_consumption: dailyCons, status: 'plenty' as InventoryStatus } as InventoryItem
        const status = computeInventoryStatus(fakeItem)
        setInvSaving(true)
        try {
            if (editingInvId) {
                await supabase.from('inventory')
                    .update({ item_name: invItemName.trim(), icon: invIcon, status, total_quantity: totalQty, daily_consumption: dailyCons, updated_by: user.id })
                    .eq('id', editingInvId)
            } else {
                await supabase.from('inventory').insert({
                    cat_id: catId,
                    item_name: invItemName.trim(),
                    icon: invIcon,
                    status,
                    total_quantity: totalQty,
                    daily_consumption: dailyCons,
                    updated_by: user.id,
                })
            }
            setInventoryModalOpen(false)
            resetInvForm()
            await loadData()
            lightHaptic()
            pushToast('success', '库存已更新')
            if (!editingInvId && catId) {
                sendInventoryNotification(catId, cat?.name || '猫咪', invItemName.trim()).catch(() => { })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '库存保存失败，请稍后重试'))
        } finally {
            setInvSaving(false)
        }
    }

    const resetInvForm = () => {
        setInvItemName('')
        setInvIcon(null)
        setInvTotalQty('')
        setInvDailyConsumption('')
        setEditingInvId(null)
    }

    const resetWeightForm = () => {
        setWeightValue('')
        setWeightDate(format(new Date(), 'yyyy-MM-dd'))
        setEditingWeightId(null)
    }

    const openEditInventory = (item: InventoryItem) => {
        setEditingInvId(item.id)
        setInvItemName(item.item_name)
        setInvIcon(item.icon || null)
        setInvTotalQty(item.total_quantity != null ? String(item.total_quantity) : '')
        setInvDailyConsumption(item.daily_consumption != null ? String(item.daily_consumption) : '')
        setInventoryModalOpen(true)
    }

    const openEditHealth = (item: HealthRecord) => {
        setEditingHealthId(item.id)
        if (item.type === 'medical' && item.name.includes('呕吐')) {
            setHealthType('vomit')
        } else {
            setHealthType(item.type)
        }
        setHealthName(item.name)
        setHealthDate(item.date)
        setHealthNextDue(item.next_due || '')
        setHealthNotes(item.notes || '')
        if (item.type === 'medical') {
            if (item.name.includes('呕吐')) setHealthMedicalPreset('vomit')
            else if (item.name.includes('咳嗽')) setHealthMedicalPreset('cough')
            else if (item.name.includes('发热')) setHealthMedicalPreset('fever')
            else setHealthMedicalPreset('other')
        }
        setHealthModalOpen(true)
    }

    const deleteHealthRecord = async (id: string) => {
        try {
            await supabase.from('health_records').delete().eq('id', id)
            lightHaptic()
            pushToast('success', '健康记录已删除')
            await loadData()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除失败，请稍后重试'))
        }
    }

    const deleteInventoryItem = async (id: string) => {
        try {
            await supabase.from('inventory').delete().eq('id', id)
            lightHaptic()
            pushToast('success', '物资已删除')
            await loadData()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除失败，请稍后重试'))
        }
    }

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
                    .update({
                        weight_kg: kg,
                        recorded_at: `${weightDate}T12:00:00.000Z`,
                    })
                    .eq('id', editingWeightId)
            } else {
                await supabase.from('weight_records').insert({
                    cat_id: catId,
                    weight_kg: kg,
                    recorded_at: `${weightDate}T12:00:00.000Z`,
                    created_by: user.id,
                })
            }

            setWeightModalOpen(false)
            resetWeightForm()
            await loadData()
            lightHaptic()
            pushToast('success', editingWeightId ? '体重已更新' : '体重记录已保存')
            if (!editingWeightId && catId) {
                sendWeightNotification(catId, cat?.name || '猫咪', kg).catch(() => { })
            }
        } catch (err) {
            pushToast('error', getErrorMessage(err, '体重保存失败，请稍后重试'))
        } finally {
            setWeightSaving(false)
        }
    }

    const deleteWeightRecord = async (id: string) => {
        try {
            await supabase.from('weight_records').delete().eq('id', id)
            lightHaptic()
            pushToast('success', '体重记录已删除')
            await loadData()
        } catch (err) {
            pushToast('error', getErrorMessage(err, '删除失败，请稍后重试'))
        }
    }

    const confirmDelete = async () => {
        if (!pendingDelete) return
        setDeleteSubmitting(true)
        try {
            if (pendingDelete.type === 'health') {
                await deleteHealthRecord(pendingDelete.id)
            }
            if (pendingDelete.type === 'inventory') {
                await deleteInventoryItem(pendingDelete.id)
            }
            if (pendingDelete.type === 'weight') {
                await deleteWeightRecord(pendingDelete.id)
            }
        } finally {
            setDeleteSubmitting(false)
            setPendingDelete(null)
        }
    }

    const exportVetReport = (lang: 'zh' | 'en') => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        const recentWeights = weights.filter((w) => new Date(w.recorded_at).getTime() >= cutoff)
        const recentHealth = healthRecords.filter((h) => new Date(h.date).getTime() >= cutoff)
        const recentVomit = healthRecords.filter((h) => {
            const inRange = new Date(h.date).getTime() >= cutoff
            const isVomit = h.type === 'medical' && h.name.includes('呕吐')
            return inRange && isVomit
        })
        const recentAbnormalPoops = poops.filter((p) => {
            const inRange = new Date(p.created_at).getTime() >= cutoff
            return inRange && isAbnormalPoop(p.bristol_type, p.color)
        })

        const isZh = lang === 'zh'
        const t = isZh
            ? {
                reportTitle: '🐱 就医报告',
                last30Days: '最近30天',
                weightChange: '体重变化',
                vomitRecords: '呕吐记录',
                abnormalPoopRecords: '异常便便记录',
                healthRecords: '健康记录',
                noRecord: '暂无记录',
                noAbnormalRecord: '暂无异常记录',
                popupBlocked: '导出窗口被拦截，请允许弹窗后重试',
                typeLabel: { vaccine: '疫苗', deworming: '驱虫', medical: '就医' } as const,
                colorLabel: { red: '红色', black: '黑色', white: '白色' } as const,
                medicalFormat: (type: string, color: string) => `布里斯托${type}型，颜色${color}`,
                healthFormat: (name: string, type: string, notes?: string | null) => `${name}（${type}）${notes ? `：${notes}` : ''}`,
            }
            : {
                reportTitle: '🐱 Vet Report',
                last30Days: 'Last 30 Days',
                weightChange: 'Weight Trend',
                vomitRecords: 'Vomiting Records',
                abnormalPoopRecords: 'Abnormal Stool Records',
                healthRecords: 'Health Records',
                noRecord: 'No records',
                noAbnormalRecord: 'No abnormal records',
                popupBlocked: 'Popup blocked. Please allow popups and try again.',
                typeLabel: { vaccine: 'Vaccine', deworming: 'Deworming', medical: 'Medical' } as const,
                colorLabel: { red: 'red', black: 'black', white: 'white' } as const,
                medicalFormat: (type: string, color: string) => `Bristol type ${type}, color ${color}`,
                healthFormat: (name: string, type: string, notes?: string | null) => `${name} (${type})${notes ? `: ${notes}` : ''}`,
            }

        const dateLocale = isZh ? 'zh-CN' : 'en-US'

        const html = `
        <html><head><meta charset="utf-8" /><title>Vet Report</title>
        <style>body{font-family:-apple-system;padding:24px;line-height:1.6}h1{margin:0 0 4px}h2{margin:20px 0 8px}ul{padding-left:18px}</style>
        </head><body>
        <h1>${escapeHtml(t.reportTitle)}</h1><div>${escapeHtml(t.last30Days)}</div>
        <h2>${escapeHtml(t.weightChange)}</h2><ul>${recentWeights.map((w) => `<li>${escapeHtml(new Date(w.recorded_at).toLocaleDateString(dateLocale))}: ${escapeHtml(String(w.weight_kg))} kg</li>`).join('') || `<li>${escapeHtml(t.noRecord)}</li>`}</ul>
        <h2>${escapeHtml(t.vomitRecords)}</h2><ul>${recentVomit.map((v) => `<li>${escapeHtml(new Date(v.date).toLocaleDateString(dateLocale))}: ${escapeHtml(v.name)}${v.notes ? (isZh ? `（${escapeHtml(v.notes)}）` : ` (${escapeHtml(v.notes)})`) : ''}</li>`).join('') || `<li>${escapeHtml(t.noRecord)}</li>`}</ul>
        <h2>${escapeHtml(t.abnormalPoopRecords)}</h2><ul>${recentAbnormalPoops.map((p) => `<li>${escapeHtml(new Date(p.created_at).toLocaleDateString(dateLocale))}: ${escapeHtml(t.medicalFormat(String(p.bristol_type), t.colorLabel[p.color as 'red' | 'black' | 'white'] ?? p.color))}</li>`).join('') || `<li>${escapeHtml(t.noAbnormalRecord)}</li>`}</ul>
        <h2>${escapeHtml(t.healthRecords)}</h2><ul>${recentHealth.map((h) => `<li>${escapeHtml(new Date(h.date).toLocaleDateString(dateLocale))}: ${escapeHtml(t.healthFormat(h.name, t.typeLabel[h.type], h.notes))}</li>`).join('') || `<li>${escapeHtml(t.noRecord)}</li>`}</ul>
        </body></html>`

        const iframe = document.createElement('iframe')
        iframe.style.position = 'fixed'
        iframe.style.right = '0'
        iframe.style.bottom = '0'
        iframe.style.width = '0'
        iframe.style.height = '0'
        iframe.style.border = '0'
        iframe.setAttribute('aria-hidden', 'true')
        document.body.appendChild(iframe)

        const cleanup = () => {
            setTimeout(() => {
                iframe.remove()
            }, 1500)
        }

        try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document
            if (!doc || !iframe.contentWindow) throw new Error('print-frame-unavailable')
            doc.open()
            doc.write(html)
            doc.close()
            const runPrint = () => {
                iframe.contentWindow?.focus()
                iframe.contentWindow?.print()
                cleanup()
            }
            if (doc.readyState === 'complete') {
                runPrint()
            } else {
                iframe.onload = runPrint
            }
        } catch {
            cleanup()
            const reportWindow = window.open('', '_blank')
            if (!reportWindow) {
                pushToast('error', t.popupBlocked)
                return
            }
            reportWindow.document.write(html)
            reportWindow.document.close()
            reportWindow.focus()
            reportWindow.print()
        }
    }

    // ─── Health type labels ───────────────────────
    const healthTypeLabels = HEALTH_TYPE_LABELS

    if (loading || catLoading) {
        return (
            <div className="stats-page fade-in">
                <div className="empty-state">
                    <span className="empty-icon">⏳</span>
                    <p className="text-secondary text-sm">加载中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="stats-page fade-in">
            <div className="page-header p-4">
                <h1 className="text-2xl font-bold">📊 统计</h1>
                <p className="text-secondary text-sm">健康数据与库存管理</p>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" onClick={() => exportVetReport('zh')}>导出就医报告（中文）</Button>
                    <Button variant="secondary" size="sm" onClick={() => exportVetReport('en')}>Export Vet Report (EN)</Button>
                    <Button variant="secondary" size="sm" onClick={() => setExportModalOpen(true)} disabled={!catId}>导出全部记录</Button>
                </div>
            </div>

            {/* ── Weight Chart ── */}
            <div className="px-4 mb-4">
                <Card variant="default" padding="md">
                    <div className="section-row">
                        <h2 className="text-lg font-semibold">⚖️ 体重趋势</h2>
                        <Button variant="ghost" size="sm" onClick={() => { resetWeightForm(); setWeightModalOpen(true) }}>
                            + 添加
                        </Button>
                    </div>
                    <div className="weight-window-row">
                        <label className="text-sm text-secondary" htmlFor="weight-window-range">趋势区间：近 {weightWindowDays} 天</label>
                        <input
                            id="weight-window-range"
                            type="range"
                            min="7"
                            max="30"
                            value={weightWindowDays}
                            onChange={(event) => setWeightWindowDays(Number(event.target.value))}
                        />
                    </div>
                    {chartData.length >= 2 ? (
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                                        stroke="rgba(255,255,255,0.1)"
                                    />
                                    <YAxis
                                        domain={['dataMin - 0.3', 'dataMax + 0.3']}
                                        tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
                                        stroke="rgba(255,255,255,0.1)"
                                        unit=" kg"
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--color-bg-card)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="weight"
                                        stroke="var(--color-primary)"
                                        strokeWidth={2.5}
                                        dot={{ fill: 'var(--color-primary)', r: 4 }}
                                        activeDot={{ r: 6 }}
                                        name="体重"
                                        unit=" kg"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="empty-state-sm">
                            <div className="empty-illu-wrap"><EmptyCatIllustration mood="play" /></div>
                            <p className="text-secondary text-sm">
                                {chartData.length === 1
                                    ? `当前体重：${chartData[0].weight} kg，再记一次就能看趋势图了`
                                    : '还没有体重记录，去记录页添加吧'}
                            </p>
                        </div>
                    )}

                    <div className="poop-charts-wrap">
                        <h3 className="text-base font-semibold">🧻 便便分布（近30天）</h3>
                        <div className="chart-container">
                            {bristolDistributionData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={bristolDistributionData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={42}
                                            outerRadius={72}
                                            paddingAngle={2}
                                        >
                                            {bristolDistributionData.map((entry, index) => (
                                                <Cell
                                                    key={`${entry.name}-${index}`}
                                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                background: 'var(--color-bg-card)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="empty-state-sm">
                                    <p className="text-secondary text-sm">近30天暂无便便记录</p>
                                </div>
                            )}
                        </div>

                        <h3 className="text-base font-semibold">🥹 咪被想次数</h3>
                        <div className="weight-window-row">
                            <label className="text-sm text-secondary" htmlFor="miss-window-range">趋势区间：近 {missWindowDays} 天</label>
                            <input
                                id="miss-window-range"
                                type="range"
                                min="7"
                                max="90"
                                value={missWindowDays}
                                onChange={(event) => setMissWindowDays(Number(event.target.value))}
                            />
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={missTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} interval={Math.max(1, Math.floor(missWindowDays / 10))} />
                                    <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--color-bg-card)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="var(--color-accent)"
                                        strokeWidth={2.5}
                                        dot={{ fill: 'var(--color-accent)', r: 3 }}
                                        activeDot={{ r: 5 }}
                                        name="咪被想次数"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <h3 className="text-base font-semibold">🍽️ 喂食次数</h3>
                        <div className="weight-window-row">
                            <label className="text-sm text-secondary" htmlFor="feed-window-range">趋势区间：近 {feedWindowDays} 天</label>
                            <input
                                id="feed-window-range"
                                type="range"
                                min="7"
                                max="90"
                                value={feedWindowDays}
                                onChange={(event) => setFeedWindowDays(Number(event.target.value))}
                            />
                        </div>
                        <div className="chart-container">
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={feedTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                                    <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} interval={Math.max(1, Math.floor(feedWindowDays / 10))} />
                                    <YAxis allowDecimals={false} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--color-bg-card)',
                                            border: '1px solid var(--color-border)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="count"
                                        stroke="var(--color-secondary)"
                                        strokeWidth={2.5}
                                        dot={{ fill: 'var(--color-secondary)', r: 3 }}
                                        activeDot={{ r: 5 }}
                                        name="喂食次数"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </Card>
            </div>

            {/* ── Health Records ── */}
            <div className="px-4 mb-4">
                <Card variant="default" padding="md">
                    <div className="section-row">
                        <h2 className="text-lg font-semibold">💉 健康记录</h2>
                        <Button variant="ghost" size="sm" onClick={() => { resetHealthForm(); setHealthModalOpen(true) }}>
                            + 添加
                        </Button>
                    </div>

                    {healthRecords.length > 0 ? (
                        <div className="health-list">
                            {healthRecords.map((r) => {
                                const viewType: HealthFormType = (r.type === 'medical' && r.name.includes('呕吐')) ? 'vomit' : r.type
                                const config = healthTypeLabels[viewType]
                                const isPastDue = r.next_due && new Date(r.next_due) < new Date()
                                return (
                                    <SwipeableRow key={r.id} onDelete={() => setPendingDelete({ id: r.id, type: 'health' })}>
                                        <button type="button" className={`health-item ${isPastDue ? 'health-past-due' : ''}`} onClick={() => openEditHealth(r)}>
                                            <span className="health-icon">{config.icon}</span>
                                            <div className="health-info">
                                                <span className="text-sm font-semibold">{r.name}</span>
                                                <span className="text-muted text-xs">{config.label} · {format(new Date(r.date), 'yyyy/MM/dd')}</span>
                                                {r.next_due && (
                                                    <span className={`text-xs ${isPastDue ? 'text-danger' : 'text-secondary'}`}>
                                                        下次：{format(new Date(r.next_due), 'yyyy/MM/dd')} {isPastDue ? '⚠️ 已过期' : ''}
                                                    </span>
                                                )}
                                            </div>
                                            {isPastDue && (r.type === 'vaccine' || r.type === 'deworming') && (
                                                <button
                                                    type="button"
                                                    className="health-renew-btn"
                                                    onClick={(e) => { e.stopPropagation(); renew.openRenewModal(r) }}
                                                >
                                                    🔄 续期
                                                </button>
                                            )}
                                        </button>
                                    </SwipeableRow>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="empty-state-sm">
                            <p className="text-secondary text-sm">暂无健康记录</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Inventory ── */}
            <div className="px-4 mb-4">
                <Card variant="default" padding="md">
                    <div className="section-row">
                        <h2 className="text-lg font-semibold">📦 物资库存</h2>
                        <Button variant="ghost" size="sm" onClick={() => { resetInvForm(); setInventoryModalOpen(true) }}>
                            + 添加
                        </Button>
                    </div>

                    {inventory.length > 0 ? (
                        <div className="inventory-list">
                            {inventory.map((item) => {
                                const days = computeDaysRemaining(item)
                                const derivedStatus = computeInventoryStatus(item)
                                return (
                                    <SwipeableRow key={item.id} onDelete={() => setPendingDelete({ id: item.id, type: 'inventory' })}>
                                        <button
                                            type="button"
                                            className="inventory-item"
                                            onClick={() => openEditInventory(item)}
                                        >
                                            <div className="inventory-item-info">
                                                <span className="text-sm">{item.icon ? `${item.icon} ` : ''}{item.item_name}</span>
                                                {days != null && (
                                                    <span className="text-xs text-muted">约剩 {Math.round(days)} 天</span>
                                                )}
                                            </div>
                                            <StatusBadge status={derivedStatus} size="sm" />
                                        </button>
                                    </SwipeableRow>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="empty-state-sm">
                            <div className="empty-illu-wrap"><EmptyCatIllustration mood="hungry" /></div>
                            <p className="text-secondary text-sm">添加猫粮、猫砂等物资，管理库存状态</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Health Modal ── */}
            <Modal isOpen={healthModalOpen} onClose={() => { setHealthModalOpen(false); resetHealthForm() }} title={editingHealthId ? '💉 编辑健康记录' : '💉 添加健康记录'}>
                <div className="health-form">
                    <div className="form-group">
                        <label className="form-label">类型</label>
                        <div className="health-type-grid">
                            {(['vaccine', 'deworming', 'medical', 'vomit'] as const).map((t) => (
                                <button
                                    key={t}
                                    className={`health-type-btn ${healthType === t ? 'health-type-active' : ''}`}
                                    onClick={() => {
                                        setHealthType(t)
                                        if (t === 'medical') {
                                            const map = { vomit: '呕吐', cough: '咳嗽', fever: '发热', other: '' }
                                            setHealthName(map[healthMedicalPreset])
                                            setHealthNextDue('')
                                        }
                                        if (t === 'vomit') {
                                            setHealthName('呕吐')
                                            setHealthNextDue('')
                                        }
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
                                <label className="form-label" htmlFor="health-medical-preset">就医类型</label>
                                <select
                                    id="health-medical-preset"
                                    className="form-input"
                                    value={healthMedicalPreset}
                                    onChange={(e) => {
                                        const next = e.target.value as 'vomit' | 'cough' | 'fever' | 'other'
                                        setHealthMedicalPreset(next)
                                        if (next === 'vomit') setHealthName('呕吐')
                                        if (next === 'cough') setHealthName('咳嗽')
                                        if (next === 'fever') setHealthName('发热')
                                        if (next === 'other') setHealthName('')
                                    }}
                                >
                                    <option value="vomit">呕吐</option>
                                    <option value="cough">咳嗽</option>
                                    <option value="fever">发热</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>
                            {healthMedicalPreset === 'other' && (
                                <div className="form-group">
                                    <label className="form-label" htmlFor="health-name">症状名称</label>
                                    <input
                                        id="health-name"
                                        className="form-input"
                                        placeholder="请输入症状"
                                        value={healthName}
                                        onChange={(e) => setHealthName(e.target.value)}
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label" htmlFor="health-notes">症状备注</label>
                                <textarea
                                    id="health-notes"
                                    className="form-input"
                                    placeholder="可填写频次、状态、触发情况"
                                    rows={3}
                                    value={healthNotes}
                                    onChange={(e) => setHealthNotes(e.target.value)}
                                />
                            </div>
                        </>
                    ) : healthType === 'vomit' ? (
                        <div className="form-group">
                            <label className="form-label" htmlFor="health-notes">呕吐备注</label>
                            <textarea
                                id="health-notes"
                                className="form-input"
                                placeholder="可填写频次、状态、触发情况"
                                rows={3}
                                value={healthNotes}
                                onChange={(e) => setHealthNotes(e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label" htmlFor="health-name">名称</label>
                            <input
                                id="health-name"
                                className="form-input"
                                placeholder={healthType === 'vaccine' ? '如：三联疫苗' : '如：大宠爱'}
                                value={healthName}
                                onChange={(e) => setHealthName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="health-date">日期</label>
                            <input
                                id="health-date"
                                type="date"
                                className="form-input"
                                value={healthDate}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => setHealthDate(e.target.value)}
                            />
                        </div>
                        {healthType === 'vaccine' || healthType === 'deworming' ? (
                            <div className="form-group flex-1">
                                <label className="form-label" htmlFor="health-next">下次到期</label>
                                <input
                                    id="health-next"
                                    type="date"
                                    className="form-input"
                                    value={healthNextDue}
                                    min={healthDate || undefined}
                                    onChange={(e) => setHealthNextDue(e.target.value)}
                                />
                            </div>
                        ) : null}
                    </div>

                    <Button variant="primary" fullWidth onClick={handleHealthSave} disabled={healthSaving || !online}>
                        {healthSaving ? '保存中...' : editingHealthId ? '更新记录' : '保存记录'}
                    </Button>
                </div>
            </Modal>

            {/* ── Inventory Modal ── */}
            <Modal isOpen={inventoryModalOpen} onClose={() => { setInventoryModalOpen(false); resetInvForm() }} title={editingInvId ? '📦 编辑库存' : '📦 添加物资'}>
                <div className="inv-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="inv-name">物资名称</label>
                        <input
                            id="inv-name"
                            className="form-input"
                            placeholder="如：猫粮、猫砂、罐头"
                            value={invItemName}
                            onChange={(e) => setInvItemName(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">图标</label>
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
                            <label className="form-label" htmlFor="inv-total-qty">总量</label>
                            <input
                                id="inv-total-qty"
                                type="number"
                                min="0"
                                step="0.1"
                                className="form-input"
                                placeholder="如：10"
                                value={invTotalQty}
                                onChange={(e) => setInvTotalQty(e.target.value)}
                            />
                        </div>
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="inv-daily-consumption">每日消耗量</label>
                            <input
                                id="inv-daily-consumption"
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-input"
                                placeholder="如：0.5"
                                value={invDailyConsumption}
                                onChange={(e) => setInvDailyConsumption(e.target.value)}
                            />
                        </div>
                    </div>

                    {invTotalQty && invDailyConsumption && parseFloat(invDailyConsumption) > 0 && (
                        <div className="inv-preview" style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: 'var(--glass-bg)' }}>
                            <p className="text-sm text-secondary">
                                预计可用 <strong>{Math.round(parseFloat(invTotalQty) / parseFloat(invDailyConsumption))}</strong> 天
                                {' · '}
                                {(() => {
                                    const days = parseFloat(invTotalQty) / parseFloat(invDailyConsumption)
                                    if (days < 3) return <span style={{ color: 'var(--color-danger)' }}>🔴 紧急</span>
                                    if (days < 7) return <span style={{ color: 'var(--color-warning)' }}>🟡 快没了</span>
                                    return <span style={{ color: 'var(--color-success)' }}>🟢 充足</span>
                                })()}
                            </p>
                        </div>
                    )}

                    <Button variant="primary" fullWidth onClick={handleInventorySave} disabled={invSaving || !online}>
                        {invSaving ? '保存中...' : editingInvId ? '更新库存' : '添加物资'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={weightModalOpen} onClose={() => { setWeightModalOpen(false); resetWeightForm() }} title={editingWeightId ? '⚖️ 编辑体重' : '⚖️ 添加体重'}>
                <div className="weight-form">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="weight-value">体重 (kg)</label>
                            <input
                                id="weight-value"
                                type="number"
                                min="0.1"
                                max="30"
                                step="0.01"
                                className="form-input"
                                value={weightValue}
                                onChange={(e) => {
                                    setWeightValue(e.target.value)
                                    setWeightError('')
                                }}
                                aria-invalid={weightError ? true : undefined}
                                aria-describedby={weightError ? 'stats-weight-error' : undefined}
                            />
                        </div>
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="weight-date">日期</label>
                            <input
                                id="weight-date"
                                type="date"
                                className="form-input"
                                value={weightDate}
                                max={format(new Date(), 'yyyy-MM-dd')}
                                onChange={(e) => setWeightDate(e.target.value)}
                            />
                        </div>
                    </div>
                    {weightError && <p className="text-xs text-danger" id="stats-weight-error">{weightError}</p>}
                    <Button variant="primary" fullWidth onClick={handleWeightSave} disabled={weightSaving || !online}>
                        {weightSaving ? '保存中...' : editingWeightId ? '更新体重' : '保存体重'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="确认删除？">
                <div className="weight-form">
                    <p className="text-sm text-secondary">此操作不可恢复，确认继续删除吗？</p>
                    <Button variant="primary" fullWidth onClick={confirmDelete} disabled={deleteSubmitting}>
                        {deleteSubmitting ? '删除中...' : '确认删除'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={exportModalOpen} onClose={() => !exporting && setExportModalOpen(false)} title="导出全部记录">
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="export-days">时间跨度：最近 {exportDays} 天（1 - {maxExportDays}）</label>
                        <input
                            id="export-days"
                            type="range"
                            min="1"
                            max={String(maxExportDays)}
                            value={exportDays}
                            onChange={(event) => setExportDays(Number(event.target.value))}
                            disabled={exporting}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">导出类型（可多选）</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {(Object.keys(exportTypes) as ExportTypeKey[]).map((key) => {
                                const labels: Record<ExportTypeKey, string> = {
                                    weight: '体重',
                                    poop: '便便',
                                    miss: '咪被想',
                                    health: '健康',
                                    inventory: '库存',
                                    diary: '日记',
                                    mood: '心情',
                                    feed: '喂食',
                                }

                                return (
                                    <label key={key} className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={exportTypes[key]}
                                            onChange={() => handleToggleExportType(key)}
                                            disabled={exporting}
                                        />
                                        <span>{labels[key]}</span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>

                    <Button variant="primary" fullWidth onClick={exportSelectedRecords} disabled={exporting || !catId}>
                        {exporting ? '导出中...' : '开始导出'}
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
                idSuffix="-stats"
            />
        </div>
    )
}
