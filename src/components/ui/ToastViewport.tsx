import { useToastStore } from '../../stores/useToastStore'
import './ToastViewport.css'

export function ToastViewport() {
    const { items, removeToast } = useToastStore()

    return (
        <div className="toast-viewport" aria-live="polite" aria-atomic="true">
            {items.map((item) => (
                <button
                    key={item.id}
                    className={`toast toast-${item.type}`}
                    onClick={() => removeToast(item.id)}
                    type="button"
                    style={{ '--toast-duration': `${item.durationMs}ms` } as React.CSSProperties}
                >
                    <span className="toast-icon">
                        {item.type === 'success' ? '✅' : item.type === 'error' ? '⚠️' : 'ℹ️'}
                    </span>
                    <span className="toast-message">{item.message}</span>
                </button>
            ))}
        </div>
    )
}
