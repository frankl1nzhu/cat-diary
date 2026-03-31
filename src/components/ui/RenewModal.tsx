import { Modal } from './Modal'
import { Button } from './Button'
import { format } from 'date-fns'
import type { HealthRecord } from '../../types/database.types'

interface RenewModalProps {
    isOpen: boolean
    onClose: () => void
    record: HealthRecord | null
    renewDate: string
    onRenewDateChange: (v: string) => void
    renewNextDue: string
    onRenewNextDueChange: (v: string) => void
    renewNotes: string
    onRenewNotesChange: (v: string) => void
    saving: boolean
    onSave: () => void
    online: boolean
    idSuffix?: string
}

export function RenewModal({
    isOpen,
    onClose,
    record,
    renewDate,
    onRenewDateChange,
    renewNextDue,
    onRenewNextDueChange,
    renewNotes,
    onRenewNotesChange,
    saving,
    onSave,
    online,
    idSuffix = '',
}: RenewModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`🔄 ${record?.type === 'vaccine' ? '疫苗' : '驱虫'}续期`}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {record && (
                    <>
                        <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 8, padding: 'var(--space-2)' }}>
                            <p className="text-sm text-secondary" style={{ margin: 0 }}>
                                📋 上次记录：<strong>{record.name}</strong>
                            </p>
                            <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
                                日期：{format(new Date(record.date), 'yyyy/MM/dd')}
                                {record.next_due && ` → 到期：${format(new Date(record.next_due), 'yyyy/MM/dd')}`}
                            </p>
                        </div>

                        <div className="form-row">
                            <div className="form-group flex-1">
                                <label className="form-label" htmlFor={`renew-date${idSuffix}`}>本次日期</label>
                                <input
                                    id={`renew-date${idSuffix}`}
                                    type="date"
                                    className="form-input"
                                    value={renewDate}
                                    onChange={(e) => onRenewDateChange(e.target.value)}
                                />
                            </div>
                            <div className="form-group flex-1">
                                <label className="form-label" htmlFor={`renew-next-due${idSuffix}`}>下次到期日</label>
                                <input
                                    id={`renew-next-due${idSuffix}`}
                                    type="date"
                                    className="form-input"
                                    value={renewNextDue}
                                    min={renewDate || undefined}
                                    onChange={(e) => onRenewNextDueChange(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor={`renew-notes${idSuffix}`}>备注（可选）</label>
                            <textarea
                                id={`renew-notes${idSuffix}`}
                                className="form-input"
                                rows={2}
                                placeholder="如：使用的品牌、剂量等"
                                value={renewNotes}
                                onChange={(e) => onRenewNotesChange(e.target.value)}
                            />
                        </div>

                        <Button variant="primary" fullWidth onClick={onSave} disabled={saving || !renewNextDue || !online}>
                            {saving ? '续期中...' : '确认续期'}
                        </Button>
                    </>
                )}
            </div>
        </Modal>
    )
}
