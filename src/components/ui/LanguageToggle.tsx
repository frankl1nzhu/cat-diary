import { useI18n } from '../../lib/i18n'
import './LanguageToggle.css'

type LanguageToggleProps = {
    className?: string
}

export function LanguageToggle({ className = '' }: LanguageToggleProps) {
    const { language, toggleLanguage, t } = useI18n()
    const title = language === 'zh' ? t('language.switchToEnglish') : t('language.switchToChinese')

    return (
        <button
            type="button"
            className={`language-toggle ${className}`.trim()}
            onClick={toggleLanguage}
            aria-label={t('language.aria')}
            title={title}
        >
            <span className="language-toggle-icon" aria-hidden="true">🌐</span>
            <span className="language-toggle-text">{language === 'zh' ? 'EN' : '中'}</span>
        </button>
    )
}
