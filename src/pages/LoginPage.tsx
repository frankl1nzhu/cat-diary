import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { signIn, useSession } from '../lib/auth'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import './LoginPage.css'

export function LoginPage() {
    const navigate = useNavigate()
    const { user } = useSession()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const pushToast = useToastStore((s) => s.pushToast)

    // Redirect if already logged in or after successful login
    useEffect(() => {
        if (user) {
            navigate('/', { replace: true })
        }
    }, [user, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            await signIn(email, password)
        } catch (err) {
            const message = getErrorMessage(err, '登录失败，请检查邮箱和密码')
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-container fade-in">
                <div className="login-header">
                    <div className="login-logo">🐱</div>
                    <h1 className="login-title">喵记</h1>
                    <p className="login-subtitle text-secondary">Cat Diary</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && (
                        <div className="login-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="login-email">邮箱</label>
                        <input
                            id="login-email"
                            type="email"
                            className="form-input"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="login-password">密码</label>
                        <input
                            id="login-password"
                            type="password"
                            className="form-input"
                            placeholder="输入密码"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={loading}
                    >
                        {loading ? '登录中...' : '登录 🐾'}
                    </Button>
                </form>

                <p className="login-footer text-muted text-xs">
                    极简记录，实时同步 ✨
                </p>
            </div>
        </div>
    )
}
