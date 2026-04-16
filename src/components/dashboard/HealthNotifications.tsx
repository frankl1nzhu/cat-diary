import { memo, useState } from 'react'
import { Card } from '../ui/Card'
import { Modal } from '../ui/Modal'
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
            confirmTitle: '停止提醒',
            confirmBody: (name: string) => `确定停止「${name}」的到期提醒吗？此操作不可撤销。`,
            confirmOk: '确认停止',
            confirmCancel: '取消',
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
            confirmTitle: 'Stop Reminder',
            confirmBody: (name: string) => `Stop the reminder for "${name}"? This cannot be undone.`,
            confirmOk: 'Confirm',
            confirmCancel: 'Cancel',
        }

    if (items.length === 0) return null

    const [pendingStop, setPendingStop] = useState<HealthNotifyItem | null>(null)

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
                            return (
                                <div
                                    key={r.id}
                                    className={`health-notify-item ${isPastDue ? 'health-notify-overdue' : 'health-notify-soon'}`}
                                >
                                    <span className="health-notify-icon">{icon}</span>
                                    <div className="health-notify-body">
                                        <div className="health-notify-name-row">
                                            <span className="text-sm font-semibold">{r.name}</span>
                                            <span className={`health-notify-days ${isPastDue ? 'text-danger' : 'text-warning'}`}>
                                                {isPastDue ? text.overdueDays(Math.abs(r.daysLeft)) : text.dueInDays(r.daysLeft)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted">
                                            {typeLabel} · {text.dueAt}: {format(new Date(r.next_due!), 'yyyy/MM/dd')}
                                        </span>
                                        <div className="health-notify-actions">
                                            <button
                                                type="button"
                                                className="health-notify-update-btn"
                                                onClick={() => renew.openRenewModal(r)}
                                            >
                                                {text.update}
                                            </button>
                                            <button
                                                type="button"
                                                className="health-notify-stop-btn"
                                                disabled={isStopping || !online}
                                                onClick={() => setPendingStop(r)}
                                            >
                                                {isStopping ? text.stopping : text.stop}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </Card>
            </div>

            <Modal
                isOpen={pendingStop !== null}
                onClose={() => setPendingStop(null)}
                title={text.confirmTitle}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {pendingStop && text.confirmBody(pendingStop.name)}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <button
                            type="button"
                            className="health-notify-stop-btn"
                            style={{ width: '100%', padding: '10px', fontSize: '14px', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                            disabled={!online || (pendingStop ? renew.stopSaving === pendingStop.id : false)}
                            onClick={() => {
                                if (!pendingStop) return
                                const r = pendingStop
                                setPendingStop(null)
                                renew.handleStop(r)
                            }}
                        >
                            {text.confirmOk}
                        </button>
                        <button
                            type="button"
                            className="health-notify-update-btn"
                            style={{ width: '100%', padding: '10px', fontSize: '14px' }}
                            onClick={() => setPendingStop(null)}
                        >
                            {text.confirmCancel}
                        </button>
                    </div>
                </div>
            </Modal>

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

