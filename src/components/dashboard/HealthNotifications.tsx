import { memo, useState, useRef, useCallback } from 'react'
import { Card } from '../ui/Card'
import { RenewModal } from '../ui/RenewModal'
import { format } from 'date-fns'
import type { HealthRecord } from '../../types/database.types'
import { useI18n } from '../../lib/i18n'

export type HealthNotifyItem = HealthRecord & { daysLeft: number }

interface HealthNotificationsProps {
    items: HealthNotifyItem[]
    renew: {
        renewModalOpen: boolean
        renewRecord: HealthRecord | null
        renewDate: string
        setRenewDate: (v: string) => void
        renewNextDue: string
        setRenewNextDue: (v: string) => void
        renewNotes: string
        setRenewNotes: (v: string) => void
        renewSaving: boolean
        stopSaving: string | null
        openRenewModal: (record: HealthRecord) => void
        closeRenewModal: () => void
        handleRenewSave: () => Promise<void>
        handleStop: (record: HealthRecord) => Promise<void>
    }
    online: boolean
}

export const HealthNotifications = memo(function HealthNotifications({ items, renew, online }: HealthNotificationsProps) {
    const { language } = useI18n()
    const text = language === 'zh'
        ? {
            title: '🩺 疫苗 / 驱虫到期通知',
            vaccine: '疫苗',
            deworming: '驱虫',
            dueAt: '到期',
            overdueDays: (days: number) => `已过期${days}天`,
            dueInDays: (days: number) => `${days}天后`,
            update: '更新',
            stopping: '停止中...',
            stop: '停止',
            confirmStop: '确认停止?',
        }
        : {
            title: '🩺 Vaccine / Deworming Alerts',
            vaccine: 'Vaccine',
            deworming: 'Deworming',
            dueAt: 'Due',
            overdueDays: (days: number) => `Overdue ${days} days`,
            dueInDays: (days: number) => `In ${days} days`,
            update: 'Update',
            stopping: 'Stopping...',
            stop: 'Stop',
            confirmStop: 'Confirm?',
        }

    if (items.length === 0) return null

    const [confirmingStopId, setConfirmingStopId] = useState<string | null>(null)
    const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleStopClick = useCallback((r: HealthNotifyItem) => {
        if (confirmingStopId === r.id) {
            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
            setConfirmingStopId(null)
            renew.handleStop(r)
        } else {
            setConfirmingStopId(r.id)
            if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
            confirmTimerRef.current = setTimeout(() => setConfirmingStopId(null), 3000)
        }
    }, [confirmingStopId, renew])

    return (
        <>
            <div className="px-4 stagger-item health-notify-card">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                        {text.title}
                    </h2>
                    <div className="health-notify-list">
                        {items.map((r) => {
                            const isPastDue = r.daysLeft <= 0
                            const icon = r.type === 'vaccine' ? '💉' : '💊'
                            const typeLabel = r.type === 'vaccine' ? text.vaccine : text.deworming
                            const isStopping = renew.stopSaving === r.id
                            const isConfirmingStop = confirmingStopId === r.id
                            return (
                                <div
                                    key={r.id}
                                    className={`health-notify-item health-notify-item-vertical ${isPastDue ? 'health-notify-overdue' : 'health-notify-soon'}`}
                                >
                                    <div className="health-notify-top">
                                        <span className="health-notify-icon">{icon}</span>
                                        <div className="health-notify-info">
                                            <span className="text-sm font-semibold">{r.name}</span>
                                            <span className="text-xs text-muted">
                                                {typeLabel} · {text.dueAt}: {format(new Date(r.next_due!), 'yyyy/MM/dd')}
                                            </span>
                                        </div>
                                    </div>
                                    <span
                                        className={`health-notify-days ${isPastDue ? 'text-danger' : 'text-warning'}`}
                                    >
                                        {isPastDue ? text.overdueDays(Math.abs(r.daysLeft)) : text.dueInDays(r.daysLeft)}
                                    </span>
                                    <div className="health-notify-actions health-notify-actions-vertical">
                                        <button
                                            type="button"
                                            className="health-notify-update-btn"
                                            onClick={() => renew.openRenewModal(r)}
                                        >
                                            {text.update}
                                        </button>
                                        <button
                                            type="button"
                                            className={`health-notify-stop-btn ${isConfirmingStop ? 'health-notify-stop-confirming' : ''}`}
                                            disabled={isStopping || !online}
                                            onClick={() => handleStopClick(r)}
                                        >
                                            {isStopping ? text.stopping : isConfirmingStop ? text.confirmStop : text.stop}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>

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
                idSuffix="-health-notify"
            />
        </>
    )
})

