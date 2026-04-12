import { memo } from 'react'
import { Card } from '../ui/Card'
import { RenewModal } from '../ui/RenewModal'
import { format } from 'date-fns'
import type { HealthRecord } from '../../types/database.types'

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
    if (items.length === 0) return null

    return (
        <>
            <div className="px-4 stagger-item health-notify-card">
                <Card variant="default" padding="md">
                    <h2 className="text-lg font-semibold" style={{ marginBottom: 'var(--space-2)' }}>
                        🩺 疫苗 / 驱虫到期通知
                    </h2>
                    <div className="health-notify-list">
                        {items.map((r) => {
                            const isPastDue = r.daysLeft <= 0
                            const icon = r.type === 'vaccine' ? '💉' : '💊'
                            const typeLabel = r.type === 'vaccine' ? '疫苗' : '驱虫'
                            const isStopping = renew.stopSaving === r.id
                            return (
                                <div
                                    key={r.id}
                                    className={`health-notify-item ${isPastDue ? 'health-notify-overdue' : 'health-notify-soon'}`}
                                >
                                    <span className="health-notify-icon">{icon}</span>
                                    <div className="health-notify-info">
                                        <span className="text-sm font-semibold">{r.name}</span>
                                        <span className="text-xs text-muted">
                                            {typeLabel} · 到期：{format(new Date(r.next_due!), 'yyyy/MM/dd')}
                                        </span>
                                    </div>
                                    <span
                                        className={`health-notify-days ${isPastDue ? 'text-danger' : 'text-warning'}`}
                                    >
                                        {isPastDue ? `已过期${Math.abs(r.daysLeft)}天` : `${r.daysLeft}天后`}
                                    </span>
                                    <div className="health-notify-actions">
                                        <button
                                            type="button"
                                            className="health-notify-update-btn"
                                            onClick={() => renew.openRenewModal(r)}
                                        >
                                            更新
                                        </button>
                                        <button
                                            type="button"
                                            className="health-notify-stop-btn"
                                            disabled={isStopping || !online}
                                            onClick={() => renew.handleStop(r)}
                                        >
                                            {isStopping ? '停止中...' : '停止'}
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

