import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { signIn, signUp, resetPassword, useSession } from '../lib/auth'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import './LoginPage.css'

type AuthTab = 'login' | 'register' | 'forgot'

export function LoginPage() {
    const navigate = useNavigate()
    const { user } = useSession()
    const pushToast = useToastStore((s) => s.pushToast)

    const [tab, setTab] = useState<AuthTab>('login')
    const [identifier, setIdentifier] = useState('')   // login: email/username/phone
    const [email, setEmail] = useState('')              // register & forgot
    const [password, setPassword] = useState('')
    const [username, setUsername] = useState('')
    const [phone, setPhone] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (user) {
            navigate('/', { replace: true })
        }
    }, [user, navigate])

    const resetForm = () => {
        setIdentifier('')
        setEmail('')
        setPassword('')
        setUsername('')
        setPhone('')
        setError(null)
    }

    const handleTabSwitch = (next: AuthTab) => {
        resetForm()
        setTab(next)
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            await signIn(identifier, password)
        } catch (err) {
            const message = getErrorMessage(err, '登录失败，请检查账号和密码')
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!username.trim()) { setError('请输入用户名'); return }
        if (username.trim().length < 2) { setError('用户名至少2个字符'); return }
        if (password.length < 6) { setError('密码至少6位'); return }

        setLoading(true)
        try {
            await signUp(email, password, username.trim(), phone.trim())
            pushToast('success', '注册成功！')
        } catch (err) {
            const message = getErrorMessage(err, '注册失败，请稍后重试')
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!email) { setError('请输入邮箱'); return }
        setLoading(true)
        try {
            await resetPassword(email)
            pushToast('success', '重置邮件已发送，请查收')
        } catch (err) {
            const message = getErrorMessage(err, '发送失败，请稍后重试')
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

                {/* Tab switcher */}
                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${tab === 'login' ? 'auth-tab-active' : ''}`}
                        onClick={() => handleTabSwitch('login')}
                    >
                        登录
                    </button>
                    <button
                        className={`auth-tab ${tab === 'register' ? 'auth-tab-active' : ''}`}
                        onClick={() => handleTabSwitch('register')}
                    >
                        注册
                    </button>
                </div>

                {tab === 'login' && (
                    <form className="login-form" onSubmit={handleLogin}>
                        {error && (
                            <div className="login-error">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="login-id">邮箱 / 用户名 / 手机号</label>
                            <input
                                id="login-id"
                                type="text"
                                className="form-input"
                                placeholder="输入邮箱、用户名或手机号"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete="username"
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

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? '登录中...' : '登录 🐾'}
                        </Button>

                        <button type="button" className="forgot-link" onClick={() => handleTabSwitch('forgot')}>
                            忘记密码？
                        </button>
                    </form>
                )}

                {tab === 'register' && (
                    <form className="login-form" onSubmit={handleRegister}>
                        {error && (
                            <div className="login-error">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-username">用户名 *</label>
                            <input
                                id="reg-username"
                                type="text"
                                className="form-input"
                                placeholder="唯一用户名"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-email">邮箱 *</label>
                            <input
                                id="reg-email"
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
                            <label className="form-label" htmlFor="reg-phone">手机号</label>
                            <input
                                id="reg-phone"
                                type="tel"
                                className="form-input"
                                placeholder="可选，如 13812345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                autoComplete="tel"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-password">密码 *</label>
                            <input
                                id="reg-password"
                                type="password"
                                className="form-input"
                                placeholder="至少6位"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                        </div>

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? '注册中...' : '注册 🐾'}
                        </Button>
                    </form>
                )}

                {tab === 'forgot' && (
                    <form className="login-form" onSubmit={handleForgot}>
                        {error && (
                            <div className="login-error">
                                <span>⚠️</span> {error}
                            </div>
                        )}

                        <p className="text-secondary text-sm" style={{ marginBottom: 'var(--space-4)' }}>
                            输入注册邮箱，我们将发送重置密码链接。
                        </p>

                        <div className="form-group">
                            <label className="form-label" htmlFor="forgot-email">邮箱</label>
                            <input
                                id="forgot-email"
                                type="email"
                                className="form-input"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? '发送中...' : '发送重置邮件'}
                        </Button>

                        <button type="button" className="forgot-link" onClick={() => handleTabSwitch('login')}>
                            返回登录
                        </button>
                    </form>
                )}

                <p className="login-footer text-muted text-xs">
                    极简记录，实时同步 ✨
                </p>
            </div>
        </div>
    )
}
