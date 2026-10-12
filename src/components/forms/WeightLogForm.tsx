import { useState, useMemo } from 'react'
import { validateWeight } from './formHelpers'
import { supabase } from '../../lib/supabase'
import { enqueueOp } from '../../lib/offlineQueue'
import { useI18n } from '../../lib/i18n'
import { useToastStore } from '../../stores/useToastStore'
import { getErrorMessage } from '../../lib/errorMessage'
import { Button } from '../ui/Button'

export interface WeightLogFormProps {
    catId: string
    userId: string
    initialWeight?: number
    onSaveSuccess: (weightKg: number) => void
    onCancel?: () => void
}

export function WeightLogForm({
    catId,
    userId,
    initialWeight,
    onSaveSuccess,
    onCancel,
}: WeightLogFormProps) {
    const { language } = useI18n()
    const pushToast = useToastStore((s) => s.pushToast)

    const [weightValue, setWeightValue] = useState(initialWeight ? String(initialWeight) : '')
    const [errorMsg, setErrorMsg] = useState('')
    const [saving, setSaving] = useState(false)

    const text = useMemo(() => language === 'zh'
        ? {
            label: '体重 (kg)',
            placeholder: '输入体重，如 4.2',
            rangeError: '体重范围需在 0.1 - 30 kg 之间',
            saving: '保存中...',
            saveRecord: '保存体重 ⚖️',
            cancel: '取消',
            success: '体重记录成功 ⚖️',
            offline: '已离线暂存体重记录，联网后自动同步 ⚖️',
            fail: '体重记录失败，请稍后重试',
        }
        : {
            label: 'Weight (kg)',
            placeholder: 'e.g. 4.2',
            rangeError: 'Weight must be between 0.1 and 30 kg',
            saving: 'Saving...',
            saveRecord: 'Save weight ⚖️',
            cancel: 'Cancel',
            success: 'Weight recorded ⚖️',
            offline: 'Saved offline, will sync when reconnected ⚖️',
            fail: 'Failed to save weight. Please try again later.',
        }, [language])

    const handleSubmit = async () => {
        if (!catId || !userId || saving) return
        const kg = parseFloat(weightValue)
        const validation = validateWeight(kg)
        if (!validation.valid) {
            setErrorMsg(text.rangeError)
            return
        }
        setErrorMsg('')
        setSaving(true)

        const now = new Date().toISOString()
        const payload = {
            cat_id: catId,
            weight_kg: kg,
            recorded_at: now,
            created_by: userId,
        }

        try {
            if (!navigator.onLine) {
                await enqueueOp({
                    table: 'weight_records',
                    type: 'insert',
                    payload,
                })
                pushToast('success', text.offline)
            } else {
                const { error } = await supabase.from('weight_records').insert(payload)
                if (error) throw error
                pushToast('success', text.success)
            }
            onSaveSuccess(kg)
        } catch (err) {
            pushToast('error', getErrorMessage(err, text.fail))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="weight-form-flow" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', display: 'block' }}>
                    {text.label}
                </label>
                <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="30"
                    className="form-input"
                    value={weightValue}
                    onChange={(e) => {
                        setWeightValue(e.target.value)
                        setErrorMsg('')
                    }}
                    placeholder={text.placeholder}
                    style={{ width: '100%', fontSize: '1rem', padding: '10px 12px' }}
                />
                {errorMsg && (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.82rem', marginTop: '4px', margin: 0 }}>
                        {errorMsg}
                    </p>
                )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {onCancel && (
                    <Button variant="ghost" fullWidth onClick={onCancel} disabled={saving}>
                        {text.cancel}
                    </Button>
                )}
                <Button variant="primary" fullWidth onClick={handleSubmit} disabled={saving || !weightValue}>
                    {saving ? text.saving : text.saveRecord}
                </Button>
            </div>
        </div>
    )
}
