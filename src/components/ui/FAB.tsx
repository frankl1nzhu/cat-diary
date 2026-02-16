import React from 'react'
import './FAB.css'

interface FABProps {
    onClick: () => void
    icon?: React.ReactNode
    label?: string
}

export function FAB({ onClick, icon, label }: FABProps) {
    return (
        <button className="fab" onClick={onClick} aria-label={label || '新增'}>
            {icon || <span className="fab-icon">＋</span>}
        </button>
    )
}
