import { useEffect } from 'react'
import './PawStampEffect.css'

export interface PawStampEffectProps {
    visible: boolean
    onComplete?: () => void
    size?: number
}

export function PawStampEffect({ visible, onComplete, size = 72 }: PawStampEffectProps) {
    useEffect(() => {
        if (!visible) return
        const timer = window.setTimeout(() => {
            onComplete?.()
        }, 650)
        return () => window.clearTimeout(timer)
    }, [visible, onComplete])

    if (!visible) return null

    return (
        <div className="paw-stamp-container" aria-hidden="true">
            <div className="paw-stamp-badge" style={{ width: size, height: size }}>
                <svg viewBox="0 0 48 48" width={size} height={size} fill="currentColor">
                    <ellipse cx="24" cy="30" rx="11" ry="9" />
                    <circle cx="12" cy="17" r="4.5" />
                    <circle cx="20" cy="12" r="4.5" />
                    <circle cx="28" cy="12" r="4.5" />
                    <circle cx="36" cy="17" r="4.5" />
                </svg>
            </div>
        </div>
    )
}
