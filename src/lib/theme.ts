export type ThemePreset = 'pink' | 'orange' | 'blue' | 'midnight'

const THEME_KEY = 'cat_diary_theme'

const themeMap: Record<ThemePreset, { primary: string; primaryDark: string; primaryLight: string }> = {
    pink: { primary: '#f8a5c2', primaryDark: '#e77fa7', primaryLight: '#fcd0df' },
    orange: { primary: '#ffb26b', primaryDark: '#f08a2f', primaryLight: '#ffd7aa' },
    blue: { primary: '#8db6ff', primaryDark: '#5e8fe8', primaryLight: '#bed4ff' },
    midnight: { primary: '#9f8cff', primaryDark: '#7e6be5', primaryLight: '#c4baff' },
}

export function applyThemePreset(preset: ThemePreset) {
    const root = document.documentElement
    const colors = themeMap[preset]
    root.style.setProperty('--color-primary', colors.primary)
    root.style.setProperty('--color-primary-dark', colors.primaryDark)
    root.style.setProperty('--color-primary-light', colors.primaryLight)
    localStorage.setItem(THEME_KEY, preset)
}

export function getStoredTheme(): ThemePreset {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'orange' || stored === 'blue' || stored === 'midnight' || stored === 'pink') {
        return stored
    }
    return 'pink'
}
