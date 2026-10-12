import type { CSSProperties } from 'react'

export type CatPosture = 'sleeping' | 'hungry_bowl' | 'lazy_stretch'

export interface EmptyStateCatProps {
    posture: CatPosture
    message: string
    description?: string
    style?: CSSProperties
    className?: string
}

export function computeIsTodayCareComplete(
    feedsCount: number,
    mood: string | null | undefined,
    poopCount: number,
): boolean {
    return feedsCount > 0 && (Boolean(mood) || poopCount > 0)
}

export function EmptyStateCat({
    posture,
    message,
    description,
    style,
    className = '',
}: EmptyStateCatProps) {
    return (
        <div
            className={`empty-state-cat ${className}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--space-6) var(--space-4)',
                textAlign: 'center',
                ...style,
            }}
        >
            <div style={{ width: 96, height: 72, marginBottom: 'var(--space-3)', color: 'var(--color-primary)' }}>
                {posture === 'hungry_bowl' && (
                    <svg viewBox="0 0 96 72" width="96" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="64" cy="52" rx="22" ry="9" fill="var(--color-bg-input)" stroke="currentColor" strokeWidth="2.5" />
                        <ellipse cx="64" cy="50" rx="16" ry="5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                        <circle cx="32" cy="38" r="16" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" />
                        <polygon points="20,28 26,14 34,24" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                        <polygon points="34,24 42,15 46,30" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                        <path d="M25 36 Q28 33 31 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M35 36 Q38 33 41 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <polygon points="33,40 35,40 34,41.5" fill="currentColor" />
                        <path d="M34 41.5 Q32 44 30 43 M34 41.5 Q36 44 38 43" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <circle cx="48" cy="46" r="4" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2" />
                    </svg>
                )}

                {posture === 'sleeping' && (
                    <svg viewBox="0 0 96 72" width="96" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <ellipse cx="48" cy="44" rx="28" ry="16" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" />
                        <circle cx="30" cy="40" r="14" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" />
                        <polygon points="22,30 25,18 32,28" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                        <polygon points="31,28 37,20 40,32" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
                        <path d="M72 46 C78 40 76 30 70 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M25 40 Q28 42 31 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <text x="64" y="24" fill="currentColor" fontSize="12" fontWeight="bold" opacity="0.8">z</text>
                        <text x="74" y="16" fill="currentColor" fontSize="15" fontWeight="bold" opacity="0.9">Z</text>
                    </svg>
                )}

                {posture === 'lazy_stretch' && (
                    <svg viewBox="0 0 96 72" width="96" height="72" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 46 Q32 30 52 32 Q68 34 76 46" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="20" cy="46" r="11" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2.5" />
                        <polygon points="12,40 14,30 20,38" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <polygon points="20,38 24,30 27,42" fill="var(--color-bg-card)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                        <line x1="16" y1="56" x2="26" y2="56" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M76 44 C82 36 84 22 78 20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M16 45 Q18 43 20 45" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <path d="M50 20 L52 15 L54 20 L59 22 L54 24 L52 29 L50 24 L45 22 Z" fill="currentColor" opacity="0.75" />
                    </svg>
                )}
            </div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)', marginBottom: description ? '4px' : 0 }}>
                {message}
            </p>
            {description && (
                <p className="text-xs text-muted" style={{ maxWidth: 240 }}>
                    {description}
                </p>
            )}
        </div>
    )
}
