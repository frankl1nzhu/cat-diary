import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { addDays, format } from 'date-fns'
import { useI18n } from '../../lib/i18n'

export interface SnoozeModalProps {
    isOpen: boolean
    title: string
    currentSnoozedUntil?: string | null
    onClose: () => void
    onConfirm: (snoozedUntilIso: string) => Promise<void> | void
    onClear?: () => Promise<void> | void
}

export function SnoozeModal({
    isOpen,
    title,
    currentSnoozedUntil,
    onClose,
    onConfirm,
    onClear,
}: SnoozeModalProps) {
    const { language } = useI18n()
    const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    const [selectedDate, setSelectedDate] = useState(() => {
        if (currentSnoozedUntil) {
            return format(new Date(currentSnoozedUntil), 'yyyy-MM-dd')
        }
        return format(addDays(new Date(), 3), 'yyyy-MM-dd')
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (currentSnoozedUntil) {
                setSelectedDate(format(new Date(currentSnoozedUntil), 'yyyy-MM-dd'))
            } else {
                setSelectedDate(format(addDays(new Date(), 3), 'yyyy-MM-dd'))
            }
        }
    }, [isOpen, currentSnoozedUntil])

    const text = language === 'zh'
        ? {
            sub: '设定一个日期，在此之前主页将彻底隐藏该提醒，直到指定日期恢复。',
            days3: '+3天',
            days7: '+7天',
            days14: '+14天',
            confirm: '确认延期',
            cancel: '取消',
            clear: '清除延期',
            saving: '保存中...',
        }
        : {
            sub: 'Snooze this alert until a future date. It will be hidden on the home page until then.',
            days3: '+3 days',
            days7: '+7 days',
            days14: '+14 days',
            confirm: 'Confirm snooze',
            cancel: 'Cancel',
            clear: 'Clear snooze',
            saving: 'Saving...',
        }

    const setQuickDays = (days: number) => {
        setSelectedDate(format(addDays(new Date(), days), 'yyyy-MM-dd'))
    }

    const handleConfirm = async () => {
        if (!selectedDate) return
        setSaving(true)
        try {
            const targetIso = new Date(`${selectedDate}T00:00:00`).toISOString()
            await onConfirm(targetIso)
            onClose()
        } finally {
            setSaving(false)
        }
    }

    const handleClear = async () => {
        if (!onClear) return
        setSaving(true)
        try {
            await onClear()
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-2) 0' }}>
                <p className="text-secondary text-sm">{text.sub}</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        type="button"
                        className="timeline-chip"
                        onClick={() => setQuickDays(3)}
                    >
                        {text.days3}
                    </button>
                    <button
                        type="button"
                        className="timeline-chip"
                        onClick={() => setQuickDays(7)}
                    >
                        {text.days7}
                    </button>
                    <button
                        type="button"
                        className="timeline-chip"
                        onClick={() => setQuickDays(14)}
                    >
                        {text.days14}
                    </button>
                </div>
                <div className="form-group">
                    <label className="form-label" htmlFor="snooze-date-input">
                        {language === 'zh' ? '提醒日期' : 'Remind date'}
                    </label>
                    <input
                        id="snooze-date-input"
                        type="date"
                        className="form-input"
                        min={tomorrowStr}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <Button
                        variant="primary"
                        style={{ flex: 1 }}
                        disabled={saving || !selectedDate}
                        onClick={handleConfirm}
                    >
                        {saving ? text.saving : text.confirm}
                    </Button>
                    {onClear && currentSnoozedUntil && (
                        <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={handleClear}
                        >
                            {text.clear}
                        </Button>
                    )}
                    <Button variant="ghost" disabled={saving} onClick={onClose}>
                        {text.cancel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
