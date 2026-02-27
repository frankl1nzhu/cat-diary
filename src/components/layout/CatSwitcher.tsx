import { useNavigate } from 'react-router-dom'
import { useCat } from '../../lib/useCat'
import './CatSwitcher.css'

export function CatSwitcher() {
    const navigate = useNavigate()
    const { cats, catId, setCatId } = useCat()

    return (
        <div className="cat-switcher-wrap">
            <select
                className="cat-switcher"
                value={catId || ''}
                onChange={(e) => setCatId(e.target.value || null)}
                aria-label="选择猫咪"
            >
                {cats.length === 0 ? (
                    <option value="">暂无猫咪</option>
                ) : (
                    cats.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                        </option>
                    ))
                )}
            </select>
            <button className="cat-add-btn" onClick={() => navigate('/settings?mode=new')}>
                ＋
            </button>
        </div>
    )
}
