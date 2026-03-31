import { useState } from 'react'
import { supabase } from './supabase'
import { useSession } from './auth'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from './errorMessage'
import { lightHaptic } from './haptics'
import { format } from 'date-fns'
import type { HealthRecord } from '../types/database.types'

/**
 * Shared hook for vaccine/deworming "renew" operations.
 * Used identically in DashboardPage and StatsPage.
 */
export function useRenewForm(opts: {
    catId: string | null
    onSuccess: () => Promise<void> | void
}) {
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)

    const [renewModalOpen, setRenewModalOpen] = useState(false)
    const [renewRecord, setRenewRecord] = useState<HealthRecord | null>(null)
    const [renewDate, setRenewDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [renewNextDue, setRenewNextDue] = useState('')
    const [renewNotes, setRenewNotes] = useState('')
    const [renewSaving, setRenewSaving] = useState(false)

    const openRenewModal = (record: HealthRecord) => {
        setRenewRecord(record)
        setRenewDate(record.next_due || format(new Date(), 'yyyy-MM-dd'))
        setRenewNextDue('')
        setRenewNotes('')
        setRenewModalOpen(true)
    }

    const closeRenewModal = () => {
        setRenewModalOpen(false)
        setRenewRecord(null)
    }

    const handleRenewSave = async () => {
        if (!opts.catId || !user || !renewRecord || !renewNextDue) return
        setRenewSaving(true)
        try {
            await supabase.from('health_records').insert({
                cat_id: opts.catId,
                type: renewRecord.type,
                name: renewRecord.name,
                date: renewDate,
                next_due: renewNextDue,
                notes: renewNotes.trim() || `续期自 ${format(new Date(renewRecord.date), 'yyyy/MM/dd')} 记录`,
                created_by: user.id,
            })
            await supabase
                .from('health_records')
                .update({ next_due: null })
                .eq('id', renewRecord.id)

            closeRenewModal()
            await opts.onSuccess()
            lightHaptic()
            pushToast('success', '续期成功 ✅')
        } catch (err) {
            pushToast('error', getErrorMessage(err, '续期失败，请稍后重试'))
        } finally {
            setRenewSaving(false)
        }
    }

    return {
        renewModalOpen,
        renewRecord,
        renewDate,
        setRenewDate,
        renewNextDue,
        setRenewNextDue,
        renewNotes,
        setRenewNotes,
        renewSaving,
        openRenewModal,
        closeRenewModal,
        handleRenewSave,
    } as const
}
