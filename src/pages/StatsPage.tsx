import { useState, useEffect, useCallback } from 'react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Modal } from '../components/ui/Modal'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/auth'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { format } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeightRecord, HealthRecord, InventoryItem, InventoryStatus } from '../types/database.types'
import './StatsPage.css'

export function StatsPage() {
    const { user } = useSession()
    const currentCatId = useAppStore((s) => s.currentCatId)
    const setCurrentCatId = useAppStore((s) => s.setCurrentCatId)
    const pushToast = useToastStore((s) => s.pushToast)

    const [weights, setWeights] = useState<WeightRecord[]>([])
    const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)

    // Modals
    const [healthModalOpen, setHealthModalOpen] = useState(false)
    const [healthType, setHealthType] = useState<'vaccine' | 'deworming' | 'medical'>('vaccine')
    const [healthName, setHealthName] = useState('')
    const [healthDate, setHealthDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [healthNextDue, setHealthNextDue] = useState('')
    const [healthSaving, setHealthSaving] = useState(false)

    const [inventoryModalOpen, setInventoryModalOpen] = useState(false)
    const [invItemName, setInvItemName] = useState('')
    const [invStatus, setInvStatus] = useState<InventoryStatus>('plenty')
    const [editingInvId, setEditingInvId] = useState<string | null>(null)
    const [invSaving, setInvSaving] = useState(false)

    // ─── Load data ────────────────────────────────
    const loadData = useCallback(async () => {
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

        const [w, h, inv] = await Promise.all([
            supabase.from('weight_records').select('*').eq('cat_id', catId).order('recorded_at', { ascending: true }),
            supabase.from('health_records').select('*').eq('cat_id', catId).order('date', { ascending: false }),
            supabase.from('inventory').select('*').eq('cat_id', catId).order('item_name', { ascending: true }),
        ])

        if (w.data) setWeights(w.data)
        if (h.data) setHealthRecords(h.data)
        if (inv.data) setInventory(inv.data)
        setLoading(false)
    }, [currentCatId, setCurrentCatId])

    useEffect(() => { loadData() }, [loadData])

    // ─── Weight chart data ────────────────────────
    const chartData = weights.map((w) => ({
        date: format(new Date(w.recorded_at), 'MM/dd'),
        weight: w.weight_kg,
    }))

    // ─── Save health record ───────────────────────
    const handleHealthSave = async () => {
        if (!currentCatId || !user || !healthName.trim()) return
        setHealthSaving(true)
        try {
            await supabase.from('health_records').insert({
                cat_id: currentCatId,
                type: healthType,
                name: healthName.trim(),
                date: healthDate,
                next_due: healthNextDue || null,
                created_by: user.id,
            })
            setHealthModalOpen(false)
            resetHealthForm()
            await loadData()
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
    }

    // ─── Save/update inventory ────────────────────
    const handleInventorySave = async () => {
        if (!currentCatId || !user || !invItemName.trim()) return
        setInvSaving(true)
        try {
            if (editingInvId) {
                await supabase.from('inventory')
                    .update({ item_name: invItemName.trim(), status: invStatus, updated_by: user.id })
                    .eq('id', editingInvId)
            } else {
                await supabase.from('inventory').insert({
                    cat_id: currentCatId,
                    item_name: invItemName.trim(),
                    status: invStatus,
                    updated_by: user.id,
                })
            }
            setInventoryModalOpen(false)
            resetInvForm()
            await loadData()
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

    const openEditInventory = (item: InventoryItem) => {
        setEditingInvId(item.id)
        setInvItemName(item.item_name)
        setInvStatus(item.status)
        setInventoryModalOpen(true)
    }

    // ─── Health type labels ───────────────────────
    const healthTypeLabels: Record<string, { icon: string; label: string }> = {
        vaccine: { icon: '💉', label: '疫苗' },
        deworming: { icon: '💊', label: '驱虫' },
        medical: { icon: '🏥', label: '就医' },
    }

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
                    <h2 className="text-lg font-semibold mb-3">⚖️ 体重趋势</h2>
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
                            <p className="text-secondary text-sm">
                                {chartData.length === 1
                                    ? `当前体重：${chartData[0].weight} kg，再记一次就能看趋势图了`
                                    : '还没有体重记录，去记录页添加吧'}
                            </p>
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
                                    <div key={r.id} className={`health-item ${isPastDue ? 'health-past-due' : ''}`}>
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
                                <div
                                    key={item.id}
                                    className="inventory-item"
                                    onClick={() => openEditInventory(item)}
                                >
                                    <span className="text-sm">{item.item_name}</span>
                                    <StatusBadge status={item.status} size="sm" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state-sm">
                            <p className="text-secondary text-sm">添加猫粮、猫砂等物资，管理库存状态</p>
                        </div>
                    )}
                </Card>
            </div>

            {/* ── Health Modal ── */}
            <Modal isOpen={healthModalOpen} onClose={() => { setHealthModalOpen(false); resetHealthForm() }} title="💉 添加健康记录">
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
                        {healthSaving ? '保存中...' : '保存记录'}
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
        </div>
    )
}
