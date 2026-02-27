import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { SwipeableRow } from '../components/ui/SwipeableRow'
import { EmptyCatIllustration } from '../components/ui/EmptyCatIllustration'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useCat } from '../lib/useCat'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { lightHaptic } from '../lib/haptics'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeightRecord, HealthRecord, InventoryItem, InventoryStatus, PoopLog } from '../types/database.types'
import './StatsPage.css'

export function StatsPage() {
    const { user } = useSession()
    const { catId } = useCat()
    const pushToast = useToastStore((s) => s.pushToast)

    const [weights, setWeights] = useState<WeightRecord[]>([])
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [poops, setPoops] = useState<PoopLog[]>([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [healthModalOpen, setHealthModalOpen] = useState(false)
    const [healthType, setHealthType] = useState<'vaccine' | 'deworming' | 'medical'>('vaccine')
    const [healthName, setHealthName] = useState('')
    const [healthDate, setHealthDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [healthNextDue, setHealthNextDue] = useState('')
    const [editingHealthId, setEditingHealthId] = useState<string | null>(null)
    const [healthSaving, setHealthSaving] = useState(false)

    const [inventoryModalOpen, setInventoryModalOpen] = useState(false)
    const [invItemName, setInvItemName] = useState('')
    const [invStatus, setInvStatus] = useState<InventoryStatus>('plenty')
    const [editingInvId, setEditingInvId] = useState<string | null>(null)
    const [invSaving, setInvSaving] = useState(false)

    const [weightModalOpen, setWeightModalOpen] = useState(false)
    const [weightValue, setWeightValue] = useState('')
    const [weightDate, setWeightDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [editingWeightId, setEditingWeightId] = useState<string | null>(null)
    const [weightSaving, setWeightSaving] = useState(false)

    // ─── Load data ────────────────────────────────
    const loadData = useCallback(async () => {
        if (!catId) { setLoading(false); return }

        const [w, h, inv, poopData] = await Promise.all([
            supabase.from('weight_records').select('*').eq('cat_id', catId).order('recorded_at', { ascending: true }),
            supabase.from('health_records').select('*').eq('cat_id', catId).order('date', { ascending: false }),
            supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true }),
            supabase.from('poop_logs').select('*').eq('cat_id', catId).order('created_at', { ascending: false }).limit(120),
        ])

        if (w.data) setWeights(w.data)
        if (h.data) setHealthRecords(h.data)
        if (inv.data) setInventory(inv.data)
        if (poopData.data) setPoops(poopData.data)
        setLoading(false)
    }, [catId])

    useEffect(() => { loadData() }, [loadData])

    // ─── Weight chart data (memoized) ───────────────
    const chartData = useMemo(() => weights.map((w) => ({
        date: format(new Date(w.recorded_at), 'MM/dd'),
        weight: w.weight_kg,
    })), [weights])

    // ─── Save health record ───────────────────────
    const handleHealthSave = async () => {
        if (!catId || !user || !healthName.trim()) return
        setHealthSaving(true)
        try {
            if (editingHealthId) {
                await supabase
                    .from('health_records')
                    .update({
                        type: healthType,
                        name: healthName.trim(),
                        date: healthDate,
                        next_due: healthNextDue || null,
                    })
                    .eq('id', editingHealthId)
            } else {
                await supabase.from('health_records').insert({
                    cat_id: catId,
                    type: healthType,
                    name: healthName.trim(),
                    date: healthDate,
                    next_due: healthNextDue || null,
                    created_by: user.id,
                })
            }
            setHealthModalOpen(false)
            resetHealthForm()
            await loadData()
            lightHaptic()
            pushToast('success', editingHealthId ? '健康记录已更新' : '健康记录已保存')
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
        setHealthType('vaccine')
        setEditingHealthId(null)
    }

    // ─── Save/update inventory ────────────────────
    const handleInventorySave = async () => {
        if (!catId || !user || !invItemName.trim()) return
        setInvSaving(true)
        try {
            if (editingInvId) {
                await supabase.from('inventory')
                    .update({ item_name: invItemName.trim(), status: invStatus, updated_by: user.id })
                    .eq('id', editingInvId)
            } else {
                await supabase.from('inventory').insert({
                    cat_id: catId,
                    item_name: invItemName.trim(),
                    status: invStatus,
                    updated_by: user.id,
                })
            }
            setInventoryModalOpen(false)
            resetInvForm()
            await loadData()
            lightHaptic()
            pushToast('success', '库存已更新')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '库存保存失败，请稍后重试'))
        } finally {
            setInvSaving(false)
        }
    }

    const resetInvForm = () => {
        setInvItemName('')
        setInvStatus('plenty')
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
        setInvStatus(item.status)
        setInventoryModalOpen(true)
    }

    const openEditHealth = (item: HealthRecord) => {
        setEditingHealthId(item.id)
        setHealthType(item.type)
        setHealthName(item.name)
        setHealthDate(item.date)
        setHealthNextDue(item.next_due || '')
        setHealthModalOpen(true)
    }

    const openEditWeight = (item: WeightRecord) => {
        setEditingWeightId(item.id)
        setWeightValue(String(item.weight_kg))
        setWeightDate(format(new Date(item.recorded_at), 'yyyy-MM-dd'))
        setWeightModalOpen(true)
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
        if (isNaN(kg) || kg <= 0) {
            pushToast('error', '请输入有效体重')
            return
        }

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

    const exportVetReport = () => {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
        const recentWeights = weights.filter((w) => new Date(w.recorded_at).getTime() >= cutoff)
        const recentHealth = healthRecords.filter((h) => new Date(h.date).getTime() >= cutoff)
        const recentAbnormalPoops = poops.filter((p) => {
            const inRange = new Date(p.created_at).getTime() >= cutoff
            const abnormal = Number(p.bristol_type) >= 6 || ['red', 'black', 'white'].includes(p.color)
            return inRange && abnormal
        })

        const html = `
        <html><head><meta charset="utf-8" /><title>Vet Report</title>
        <style>body{font-family:-apple-system;padding:24px;line-height:1.6}h1{margin:0 0 4px}h2{margin:20px 0 8px}ul{padding-left:18px}</style>
        </head><body>
        <h1>🐱 就医报告</h1><div>最近30天</div>
        <h2>体重变化</h2><ul>${recentWeights.map((w) => `<li>${new Date(w.recorded_at).toLocaleDateString()}：${w.weight_kg} kg</li>`).join('') || '<li>暂无记录</li>'}</ul>
        <h2>异常便便记录</h2><ul>${recentAbnormalPoops.map((p) => `<li>${new Date(p.created_at).toLocaleDateString()}：布里斯托${p.bristol_type}型，颜色${p.color}</li>`).join('') || '<li>暂无异常记录</li>'}</ul>
        <h2>健康记录</h2><ul>${recentHealth.map((h) => `<li>${new Date(h.date).toLocaleDateString()}：${h.name}（${h.type}）</li>`).join('') || '<li>暂无记录</li>'}</ul>
        </body></html>`

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

    // ─── Health type labels ───────────────────────
    const healthTypeLabels: Record<string, { icon: string; label: string }> = {
        vaccine: { icon: '💉', label: '疫苗' },
        deworming: { icon: '💊', label: '驱虫' },
        medical: { icon: '🏥', label: '就医' },
    }

    const recentWeights = [...weights].sort(
        (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
    )

    if (loading) {
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
                    <div className="mb-4">
                        <Button variant="secondary" size="sm" onClick={exportVetReport}>导出最近30天就医报告</Button>
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

                    {recentWeights.length > 0 && (
                        <div className="weight-list">
                            {recentWeights.slice(0, 20).map((item) => (
                                <SwipeableRow key={item.id} onDelete={() => deleteWeightRecord(item.id)}>
                                    <div className="weight-item" onClick={() => openEditWeight(item)}>
                                        <span className="text-sm font-semibold">{item.weight_kg} kg</span>
                                        <span className="text-muted text-xs">{format(new Date(item.recorded_at), 'yyyy/MM/dd')}</span>
                                    </div>
                                </SwipeableRow>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Health Records ── */}
            <div className="px-4 mb-4">
                <Card variant="default" padding="md">
                    <div className="section-row">
                        <h2 className="text-lg font-semibold">💉 健康记录</h2>
                        <Button variant="ghost" size="sm" onClick={() => setHealthModalOpen(true)}>
                            + 添加
                        </Button>
                    </div>

                    {healthRecords.length > 0 ? (
                        <div className="health-list">
                            {healthRecords.map((r) => {
                                const config = healthTypeLabels[r.type]
                                const isPastDue = r.next_due && new Date(r.next_due) < new Date()
                                return (
                                    <SwipeableRow key={r.id} onDelete={() => deleteHealthRecord(r.id)}>
                                        <div className={`health-item ${isPastDue ? 'health-past-due' : ''}`} onClick={() => openEditHealth(r)}>
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
                                        </div>
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
                            {inventory.map((item) => (
                                <SwipeableRow key={item.id} onDelete={() => deleteInventoryItem(item.id)}>
                                    <div
                                        className="inventory-item"
                                        onClick={() => openEditInventory(item)}
                                    >
                                        <span className="text-sm">{item.item_name}</span>
                                        <StatusBadge status={item.status} size="sm" />
                                    </div>
                                </SwipeableRow>
                            ))}
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
                            {(['vaccine', 'deworming', 'medical'] as const).map((t) => (
                                <button
                                    key={t}
                                    className={`health-type-btn ${healthType === t ? 'health-type-active' : ''}`}
                                    onClick={() => setHealthType(t)}
                                >
                                    {healthTypeLabels[t].icon} {healthTypeLabels[t].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="health-name">名称</label>
                        <input
                            id="health-name"
                            className="form-input"
                            placeholder="如：三联疫苗、大宠爱"
                            value={healthName}
                            onChange={(e) => setHealthName(e.target.value)}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="health-date">日期</label>
                            <input
                                id="health-date"
                                type="date"
                                className="form-input"
                                value={healthDate}
                                onChange={(e) => setHealthDate(e.target.value)}
                            />
                        </div>
                        <div className="form-group flex-1">
                            <label className="form-label" htmlFor="health-next">下次到期</label>
                            <input
                                id="health-next"
                                type="date"
                                className="form-input"
                                value={healthNextDue}
                                onChange={(e) => setHealthNextDue(e.target.value)}
                            />
                        </div>
                    </div>

                    <Button variant="primary" fullWidth onClick={handleHealthSave} disabled={healthSaving}>
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
                        <label className="form-label">库存状态</label>
                        <div className="inv-status-grid">
                            {([
                                { value: 'plenty' as const, label: '🟢 充足', color: 'var(--color-success)' },
                                { value: 'low' as const, label: '🟡 快没了', color: 'var(--color-warning)' },
                                { value: 'urgent' as const, label: '🔴 紧急', color: 'var(--color-danger)' },
                            ]).map((opt) => (
                                <button
                                    key={opt.value}
                                    className={`inv-status-btn ${invStatus === opt.value ? 'inv-status-active' : ''}`}
                                    style={invStatus === opt.value ? { borderColor: opt.color } : undefined}
                                    onClick={() => setInvStatus(opt.value)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button variant="primary" fullWidth onClick={handleInventorySave} disabled={invSaving}>
                        {invSaving ? '保存中...' : editingInvId ? '更新库存' : '添加物资'}
                    </Button>
                </div>
            </Modal>

            <Modal isOpen={weightModalOpen} onClose={() => { setWeightModalOpen(false); resetWeightForm() }} title={editingWeightId ? '⚖️ 编辑体重' : '⚖️ 添加体重'}>
                <div className="weight-form">
                    <div className="form-group">
                        <label className="form-label" htmlFor="weight-value">体重 (kg)</label>
                        <input
                            id="weight-value"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            placeholder="4.50"
                            value={weightValue}
                            onChange={(e) => setWeightValue(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="weight-date">日期</label>
                        <input
                            id="weight-date"
                            type="date"
                            className="form-input"
                            value={weightDate}
                            onChange={(e) => setWeightDate(e.target.value)}
                        />
                    </div>
                    <Button variant="primary" fullWidth onClick={handleWeightSave} disabled={weightSaving}>
                        {weightSaving ? '保存中...' : editingWeightId ? '更新体重' : '保存体重'}
                    </Button>
                </div>
            </Modal>
        </div>
    )
}
