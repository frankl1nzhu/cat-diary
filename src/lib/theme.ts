export type ThemePreset = 'pink' | 'orange' | 'blue' | 'midnight'

const THEME_KEY = 'cat_diary_theme'

const themeMap: Record<ThemePreset, { primary: string; primaryDark: string; primaryLight: string; glow: string }> = {
    pink: { primary: '#f8a5c2', primaryDark: '#e77fa7', primaryLight: '#fcd0df', glow: 'rgba(248, 165, 194, 0.3)' },
    orange: { primary: '#ffb26b', primaryDark: '#f08a2f', primaryLight: '#ffd7aa', glow: 'rgba(255, 178, 107, 0.3)' },
    blue: { primary: '#8db6ff', primaryDark: '#5e8fe8', primaryLight: '#bed4ff', glow: 'rgba(141, 182, 255, 0.3)' },
    midnight: { primary: '#9f8cff', primaryDark: '#7e6be5', primaryLight: '#c4baff', glow: 'rgba(159, 140, 255, 0.3)' },
}

export function applyThemePreset(preset: ThemePreset) {
    const root = document.documentElement
    const colors = themeMap[preset]
    // Smooth color transition when switching themes
    root.style.setProperty('transition', 'color 300ms ease, background-color 300ms ease')
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-dark', colors.primaryDark)
    root.style.setProperty('--color-primary-light', colors.primaryLight)
    root.style.setProperty('--shadow-glow', `0 0 20px ${colors.glow}`)
    root.style.setProperty('--shadow-glow-lg', `0 0 40px ${colors.glow}, 0 0 80px ${colors.glow.replace('0.3', '0.1')}`)
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
