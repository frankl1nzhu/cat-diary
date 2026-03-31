import { Card } from '../ui/Card'
import { RenewModal } from '../ui/RenewModal'
import { format } from 'date-fns'
import type { HealthRecord } from '../../types/database.types'

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
        openRenewModal: (record: HealthRecord) => void
        closeRenewModal: () => void
        handleRenewSave: () => Promise<void>
    }
    online: boolean
}

export function HealthReminders({ items, renew, online }: HealthRemindersProps) {
    if (items.length === 0) return null

    return (
        <>
            <div className="px-4 stagger-item" style={{ marginBottom: 'var(--space-3)' }}>
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                        🩺 疫苗 / 驱虫提醒
                    </h2>
                    <div className="health-reminder-list">
                        {items.map((r) => {
                            const isPastDue = r.daysLeft <= 0
                            const isUrgent = r.daysLeft <= 7
                            const icon = r.type === 'vaccine' ? '💉' : '💊'
                            const typeLabel = r.type === 'vaccine' ? '疫苗' : '驱虫'
                            return (
                                <div
                                    key={r.id}
                                    className={`health-reminder-item ${isPastDue ? 'health-reminder-overdue' : isUrgent ? 'health-reminder-urgent' : ''}`}
                                >
                                    <span className="health-reminder-icon">{icon}</span>
                                    <div className="health-reminder-info">
                                        <span className="text-sm font-semibold">{r.name}</span>
                                        <span className="text-xs text-muted">
                                            {typeLabel} · 到期：{format(new Date(r.next_due!), 'yyyy/MM/dd')}
                                        </span>
                                    </div>
                                    <span
                                        className={`health-reminder-days ${isPastDue ? 'text-danger' : isUrgent ? 'text-warning' : 'text-secondary'}`}
                                    >
                                        {isPastDue ? `过期${Math.abs(r.daysLeft)}天` : `${r.daysLeft}天`}
                                    </span>
                                    {isPastDue && (
                                        <button
                                            type="button"
                                            className="health-renew-btn"
                                            onClick={() => renew.openRenewModal(r)}
                                        >
                                            🔄 续期
                                        </button>
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
}
