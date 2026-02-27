import { useToastStore } from '../../stores/useToastStore'
import './ToastViewport.css'

export function ToastViewport() {
    const items = useToastStore((s) => s.items)
    const removeToast = useToastStore((s) => s.removeToast)

    return (
        <div className="toast-viewport" aria-live="polite" aria-atomic="true">
            {items.map((item) => (
                <button
                    key={item.id}
                    className={`toast toast-${item.type}`}
                    onClick={() => removeToast(item.id)}
                    type="button"
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
