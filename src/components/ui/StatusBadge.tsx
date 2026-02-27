import './StatusBadge.css'

type StatusType = 'plenty' | 'low' | 'urgent' | 'fed' | 'not_fed'

interface StatusBadgeProps {
    status: StatusType
    label?: string
    size?: 'sm' | 'md'
}

const statusConfig: Record<StatusType, { emoji: string; color: string; text: string }> = {
    plenty: { emoji: '🟢', color: 'var(--color-success)', text: '充足' },
    low: { emoji: '🟡', color: 'var(--color-warning)', text: '快没了' },
    urgent: { emoji: '🔴', color: 'var(--color-danger)', text: '紧急' },
    fed: { emoji: '✅', color: 'var(--color-success)', text: '已喂食' },
    not_fed: { emoji: '⏳', color: 'var(--color-warning)', text: '未喂食' },
}

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
    const config = statusConfig[status]

    return (
        <span
            className={`status-badge status-badge-${size}`}
            style={{ '--badge-color': config.color } as React.CSSProperties}
        >
            <span className="status-badge-dot">{config.emoji}</span>
            <span className="status-badge-text">{label || config.text}</span>
        </span>
    )
}
