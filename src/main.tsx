import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyThemePreset, getStoredTheme } from './lib/theme'
import { initAppearanceListener } from './lib/appearance'
import { LanguageProvider } from './lib/i18n'
import './index.css'

applyThemePreset(getStoredTheme())
initAppearanceListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>
)
