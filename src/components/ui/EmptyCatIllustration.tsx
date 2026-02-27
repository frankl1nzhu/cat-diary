interface EmptyCatIllustrationProps {
    mood: 'play' | 'hungry'
}

export function EmptyCatIllustration({ mood }: EmptyCatIllustrationProps) {
    if (mood === 'hungry') {
        return (
            <svg width="140" height="96" viewBox="0 0 140 96" role="img" aria-label="饥饿的猫咪插图">
                <circle cx="70" cy="48" r="30" fill="var(--color-bg-input)" />
                <circle cx="58" cy="44" r="4" fill="var(--color-text)" />
                <circle cx="82" cy="44" r="4" fill="var(--color-text)" />
                <path d="M60 60 Q70 67 80 60" stroke="var(--color-text)" strokeWidth="3" fill="none" />
                <rect x="45" y="74" width="50" height="10" rx="5" fill="var(--color-border)" />
                <text x="70" y="93" textAnchor="middle" fontSize="11" fill="var(--color-text-secondary)">空碗碗...</text>
            </svg>
        )
    }

    return (
        <svg width="140" height="96" viewBox="0 0 140 96" role="img" aria-label="玩耍的猫咪插图">
            <circle cx="70" cy="48" r="30" fill="var(--color-bg-input)" />
            <circle cx="58" cy="44" r="4" fill="var(--color-text)" />
            <circle cx="82" cy="44" r="4" fill="var(--color-text)" />
            <path d="M60 56 Q70 64 80 56" stroke="var(--color-text)" strokeWidth="3" fill="none" />
            <circle cx="112" cy="34" r="10" fill="var(--color-primary-light)" />
            <text x="112" y="38" textAnchor="middle" fontSize="10">🧶</text>
        </svg>
    )
}
