import { memo } from 'react'
import { Card } from '../ui/Card'
import { RenewModal } from '../ui/RenewModal'
import { format } from 'date-fns'
import type { HealthRecord } from '../../types/database.types'
import { useI18n } from '../../lib/i18n'

export type HealthReminderItem = HealthRecord & { daysLeft: number }

interface HealthRemindersProps {
    items: HealthReminderItem[]
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

export const HealthReminders = memo(function HealthReminders({ items, renew, online }: HealthRemindersProps) {
    const { language } = useI18n()
    const text = language === 'zh'
        ? {
            title: '🩺 疫苗 / 驱虫提醒',
            vaccine: '疫苗',
            deworming: '驱虫',
            dueAt: '到期',
            overdueDays: (days: number) => `过期${days}天`,
            leftDays: (days: number) => `${days}天`,
            renew: '🔄 续期',
            stopping: '停止中...',
            stop: '停止',
        }
        : {
            title: '🩺 Vaccine / Deworming Reminders',
            vaccine: 'Vaccine',
            deworming: 'Deworming',
            dueAt: 'Due',
            overdueDays: (days: number) => `Overdue ${days} days`,
            leftDays: (days: number) => `${days} days`,
            renew: '🔄 Renew',
            stopping: 'Stopping...',
            stop: 'Stop',
        }

    if (items.length === 0) return null

    return (
        <>
            <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                        {text.title}
                    </h2>
                    <div className="health-reminder-list">
                        {items.map((r) => {
                            const isPastDue = r.daysLeft <= 0
                            const isUrgent = r.daysLeft <= 7
                            const icon = r.type === 'vaccine' ? '💉' : '💊'
                            const typeLabel = r.type === 'vaccine' ? text.vaccine : text.deworming
                            const isStopping = renew.stopSaving === r.id
                            return (
                                <div
                                    key={r.id}
                                    className={`health-reminder-item ${isPastDue ? 'health-reminder-overdue' : isUrgent ? 'health-reminder-urgent' : ''}`}
                                >
                                    <span className="health-reminder-icon">{icon}</span>
                                    <div className="health-reminder-info">
                                        <span className="text-sm font-semibold">{r.name}</span>
                                        <span className="text-xs text-muted">
                                            {typeLabel} · {text.dueAt}: {format(new Date(r.next_due!), 'yyyy/MM/dd')}
                                        </span>
                                    </div>
                                    <span
                                        className={`health-reminder-days ${isPastDue ? 'text-danger' : isUrgent ? 'text-warning' : 'text-secondary'}`}
                                    >
                                        {isPastDue ? text.overdueDays(Math.abs(r.daysLeft)) : text.leftDays(r.daysLeft)}
                                    </span>
                                    {isPastDue && (
                                        <div className="health-notify-actions">
                                            <button
                                                type="button"
                                                className="health-renew-btn"
                                                onClick={() => renew.openRenewModal(r)}
                                            >
                                                {text.renew}
                                            </button>
                                            <button
                                                type="button"
                                                className="health-notify-stop-btn"
                                                disabled={isStopping || !online}
                                                onClick={() => renew.handleStop(r)}
                                            >
                                                {isStopping ? text.stopping : text.stop}
                                            </button>
                                        </div>
                                    )}
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
                idSuffix="-dash"
            />
        </>
    )
})

