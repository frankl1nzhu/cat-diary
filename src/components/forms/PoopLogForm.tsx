import { useState, useMemo } from 'react'
import type { BristolType, PoopColor } from '../../types/database.types'
import { BRISTOL_LABELS, POOP_COLOR_LABELS, isAbnormalPoop } from '../../lib/constants'
import { sendAbnormalPoopNotification } from '../../lib/pushServer'
import { supabase } from '../../lib/supabase'
import { enqueueOp } from '../../lib/offlineQueue'
import { useI18n } from '../../lib/i18n'
import { useToastStore } from '../../stores/useToastStore'
import { getErrorMessage } from '../../lib/errorMessage'
import { Button } from '../ui/Button'

export interface PoopLogFormProps {
    catId: string
    catName?: string
    userId: string
    initialBristol?: BristolType
    initialColor?: PoopColor
    onSaveSuccess: () => void
    onCancel?: () => void
}

export function PoopLogForm({
    catId,
    catName = '猫咪',
    userId,
    initialBristol = '4',
    initialColor = 'brown',
    onSaveSuccess,
    onCancel,
}: PoopLogFormProps) {
    const { language } = useI18n()
    const pushToast = useToastStore((s) => s.pushToast)

    const [selectedBristol, setSelectedBristol] = useState<BristolType>(initialBristol)
    const [selectedColor, setSelectedColor] = useState<PoopColor>(initialColor)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)

    const text = useMemo(() => language === 'zh'
        ? {
            bristolLabel: '布里斯托分类',
            colorLabel: '便便颜色',
            notesLabel: '备注（选填）',
            notesPlaceholder: '如：量偏少、有毛发等',
            typePrefix: '类型',
            saving: '保存中...',
            saveRecord: '保存记录 💩',
            cancel: '取消',
            poopSuccess: '铲屎记录成功 💩',
            poopOffline: '已离线暂存铲屎记录，联网后自动同步 💩',
            poopFail: '铲屎记录失败，请稍后重试',
        }
        : {
            bristolLabel: 'Bristol scale',
            colorLabel: 'Color',
            notesLabel: 'Notes (optional)',
            notesPlaceholder: 'e.g. Small amount, hairballs',
            typePrefix: 'Type',
            saving: 'Saving...',
            saveRecord: 'Save record 💩',
            cancel: 'Cancel',
            poopSuccess: 'Poop log saved 💩',
            poopOffline: 'Saved offline, will sync when reconnected 💩',
            poopFail: 'Failed to save poop log. Please try again later.',
        }, [language])

    const bristolLabels = language === 'zh'
        ? BRISTOL_LABELS
        : {
            1: '🌰 Separate hard lumps',
            2: '🥜 Lumpy sausage',
            3: '🌭 Sausage with cracks',
            4: '🍌 Smooth soft sausage (Ideal)',
            5: '🍮 Soft blobs with clear edges',
            6: '🥣 Mushy with ragged edges',
            7: '💧 Entirely liquid',
        }

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

    const handleSubmit = async () => {
        if (!catId || !userId || saving) return
        setSaving(true)

        try {
            const payload = {
                cat_id: catId,
                bristol_type: selectedBristol,
                color: selectedColor,
                notes: notes.trim() || null,
                created_by: userId,
            }

            if (!navigator.onLine) {
                await enqueueOp({
                    table: 'poop_logs',
                    type: 'insert',
                    payload,
                })
                pushToast('success', text.poopOffline)
            } else {
                const { error } = await supabase.from('poop_logs').insert(payload)
                if (error) throw error
                pushToast('success', text.poopSuccess)
            }

            if (isAbnormalPoop(selectedBristol, selectedColor)) {
                sendAbnormalPoopNotification(catId, catName, selectedBristol, selectedColor).catch(() => {})
            }

            onSaveSuccess()
        } catch (err) {
            pushToast('error', getErrorMessage(err, text.poopFail))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="poop-form-flow" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bristol scale */}
            <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                    {text.bristolLabel}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                    {(['1', '2', '3', '4', '5', '6', '7'] as BristolType[]).map((type) => {
                        const isSelected = selectedBristol === type
                        return (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setSelectedBristol(type)}
                                style={{
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                                    background: isSelected ? 'rgba(var(--color-primary-rgb, 99, 102, 241), 0.12)' : 'var(--card-bg, #ffffff)',
                                    color: isSelected ? 'var(--color-primary)' : 'inherit',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    textAlign: 'left',
                                    fontWeight: isSelected ? 600 : 400,
                                }}
                            >
                                <span style={{ fontWeight: 700 }}>{text.typePrefix} {type}</span>
                                <div style={{ opacity: 0.8, marginTop: '2px' }}>{bristolLabels[type]}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Poop color */}
            <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px', display: 'block' }}>
                    {text.colorLabel}
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(['brown', 'dark_brown', 'yellow', 'green', 'red', 'black', 'white'] as PoopColor[]).map((color) => {
                        const isSelected = selectedColor === color
                        return (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setSelectedColor(color)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                                    background: isSelected ? 'rgba(var(--color-primary-rgb, 99, 102, 241), 0.12)' : 'var(--card-bg, #ffffff)',
                                    color: isSelected ? 'var(--color-primary)' : 'inherit',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    fontWeight: isSelected ? 600 : 400,
                                }}
                            >
                                {poopColorLabels[color]}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Optional Notes */}
            <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>
                    {text.notesLabel}
                </label>
                <input
                    type="text"
                    className="form-input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={text.notesPlaceholder}
                    style={{ width: '100%', padding: '8px 12px' }}
                />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {onCancel && (
                    <Button variant="ghost" fullWidth onClick={onCancel} disabled={saving}>
                        {text.cancel}
                    </Button>
                )}
                <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving}>
                    {saving ? text.saving : text.saveRecord}
                </Button>
            </div>
        </div>
    )
}
