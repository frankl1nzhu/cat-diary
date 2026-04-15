import { useNavigate } from 'react-router-dom'
import { useCat } from '../../lib/useCat'
import { useI18n } from '../../lib/i18n'
import { LanguageToggle } from '../ui/LanguageToggle'
import './CatSwitcher.css'

export function CatSwitcher() {
    const navigate = useNavigate()
    const { t } = useI18n()
    const { cats, catId, setCatId } = useCat()

    return (
        <div className="cat-switcher-wrap">
            <select
                className="cat-switcher"
                value={catId || ''}
                onChange={(e) => setCatId(e.target.value || null)}
                aria-label={t('cat.select')}
            >
                {cats.length === 0 ? (
                    <option value="">{t('cat.none')}</option>
                ) : (
                    cats.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))
                )}
            </select>
            <button type="button" className="cat-add-btn" onClick={() => navigate('/settings?mode=new')} aria-label={t('cat.add')}>
                ＋
            </button>
            <LanguageToggle className="cat-language-toggle" />
        </div>
    )
}
