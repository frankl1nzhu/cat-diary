export type AppearanceMode = 'system' | 'light' | 'dark'

const APPEARANCE_KEY = 'cat_diary_appearance'

export function getStoredAppearance(): AppearanceMode {
  const stored = localStorage.getItem(APPEARANCE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function applyAppearanceMode(mode: AppearanceMode) {
  localStorage.setItem(APPEARANCE_KEY, mode)
  const root = document.documentElement

  if (mode === 'system') {
    const isLight = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
    root.setAttribute('data-theme-mode', isLight ? 'light' : 'dark')
  } else {
    root.setAttribute('data-theme-mode', mode)
  }
}

export function initAppearanceListener(): () => void {
  const mode = getStoredAppearance()
  applyAppearanceMode(mode)

  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {}
  }

  const media = window.matchMedia('(prefers-color-scheme: light)')
  const listener = () => {
    if (getStoredAppearance() === 'system') {
      applyAppearanceMode('system')
    }
  }

  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
