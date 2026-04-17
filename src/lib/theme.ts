export type ThemePreset = 'pink' | 'orange' | 'blue' | 'midnight'

const THEME_KEY = 'cat_diary_theme'

const themeMap: Record<ThemePreset, {
    primary: string; primaryDark: string; primaryLight: string;
    primaryRgb: string; onPrimary: string
}> = {
    pink: { primary: '#f8a5c2', primaryDark: '#e77fa7', primaryLight: '#fcd0df', primaryRgb: '248, 165, 194', onPrimary: '#1a1625' },
    orange: { primary: '#ffb26b', primaryDark: '#f08a2f', primaryLight: '#ffd7aa', primaryRgb: '255, 178, 107', onPrimary: '#1a1625' },
    blue: { primary: '#8db6ff', primaryDark: '#5e8fe8', primaryLight: '#bed4ff', primaryRgb: '141, 182, 255', onPrimary: '#1a1625' },
    midnight: { primary: '#9f8cff', primaryDark: '#7e6be5', primaryLight: '#c4baff', primaryRgb: '159, 140, 255', onPrimary: '#ffffff' },
}

const ALPHA_LEVELS = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4] as const

export function applyThemePreset(preset: ThemePreset) {
    const root = document.documentElement
    const colors = themeMap[preset]
    // Smooth color transition when switching themes
    root.style.setProperty('transition', 'color 300ms ease, background-color 300ms ease')
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-dark', colors.primaryDark)
    root.style.setProperty('--color-primary-light', colors.primaryLight)
    root.style.setProperty('--color-on-primary', colors.onPrimary)

    // Primary alpha variants
    for (const a of ALPHA_LEVELS) {
        root.style.setProperty(`--color-primary-a${Math.round(a * 100)}`, `rgba(${colors.primaryRgb}, ${a})`)
    }

    // Glow shadows
    root.style.setProperty('--shadow-glow', `0 0 20px rgba(${colors.primaryRgb}, 0.3)`)
    root.style.setProperty('--shadow-glow-lg', `0 0 40px rgba(${colors.primaryRgb}, 0.25), 0 0 80px rgba(${colors.primaryRgb}, 0.1)`)

    localStorage.setItem(THEME_KEY, preset)
    // Remove transition after colors settle to avoid interfering with other animations
    requestAnimationFrame(() => {
        setTimeout(() => root.style.removeProperty('transition'), 350)
    })
}

export function getStoredTheme(): ThemePreset {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored && stored in themeMap) {
        return stored as ThemePreset
    }
    return 'pink'
}
