import { useState } from 'react'
import { supabase } from './supabase'
import { useSession } from './auth'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from './errorMessage'
import { lightHaptic } from './haptics'

/**
 * Shared hook for weight save/update operations.
 * Deduplicates logic from LogPage and StatsPage.
 */
export function useWeightSave(opts: {
    catId: string | null
    onSuccess: () => Promise<void> | void
}) {
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)
    const [weightSaving, setWeightSaving] = useState(false)
    const [weightError, setWeightError] = useState('')

    const validateWeight = (value: string): number | null => {
        const kg = parseFloat(value)
        if (isNaN(kg) || kg < 0.1 || kg > 30) {
            setWeightError('体重需在 0.1 到 30kg 之间')
            return null
        }
        setWeightError('')
        return kg
    }

    const saveWeight = async (
        value: string,
        editingId?: string | null,
        recordedAt?: string,
    ) => {
        if (!opts.catId || !user) return false
        const kg = validateWeight(value)
        if (kg === null) return false

        setWeightSaving(true)
        try {
            if (editingId) {
                const updateData: Record<string, unknown> = { weight_kg: kg }
                if (recordedAt) updateData.recorded_at = recordedAt
                const { error } = await supabase
                    .from('weight_records')
                    .update(updateData)
                    .eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('weight_records').insert({
                    cat_id: opts.catId,
                    weight_kg: kg,
                    recorded_at: recordedAt || new Date().toISOString(),
                    created_by: user.id,
                })
                if (error) throw error
            }
            await opts.onSuccess()
            lightHaptic()
            pushToast('success', editingId ? '体重已更新 ⚖️' : '体重记录成功 ⚖️')
            return true
        } catch (err) {
            pushToast('error', getErrorMessage(err, '体重保存失败，请稍后重试'))
            return false
        } finally {
            setWeightSaving(false)
        }
    }

    return { saveWeight, weightSaving, weightError, setWeightError } as const
}
