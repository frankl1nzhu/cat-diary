import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { LanguageToggle } from '../components/ui/LanguageToggle'
import { signIn, signUp, resetPassword, useSession } from '../lib/auth'
import { useToastStore } from '../stores/useToastStore'
import { getErrorMessage } from '../lib/errorMessage'
import { useI18n } from '../lib/i18n'
import './LoginPage.css'

type AuthTab = 'login' | 'register' | 'forgot'

export function LoginPage() {
    const navigate = useNavigate()
    const { user } = useSession()
    const { t } = useI18n()
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
            const message = getErrorMessage(err, t('login.error.signIn'))
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!username.trim()) { setError(t('login.error.usernameRequired')); return }
        if (username.trim().length < 2) { setError(t('login.error.usernameMin')); return }
        if (password.length < 6) { setError(t('login.error.passwordMin')); return }

        setLoading(true)
        try {
            await signUp(email, password, username.trim(), phone.trim())
            pushToast('success', t('login.toast.registerSuccess'))
        } catch (err) {
            const message = getErrorMessage(err, t('login.error.register'))
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (!email) { setError(t('login.error.emailRequired')); return }
        setLoading(true)
        try {
            await resetPassword(email)
            pushToast('success', t('login.toast.resetSent'))
        } catch (err) {
            const message = getErrorMessage(err, t('login.error.resetSend'))
            setError(message)
            pushToast('error', message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-language-toggle-wrap">
                <LanguageToggle />
            </div>
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
                        {t('login.tab.login')}
                    </button>
                    <button
                        className={`auth-tab ${tab === 'register' ? 'auth-tab-active' : ''}`}
                        onClick={() => handleTabSwitch('register')}
                    >
                        {t('login.tab.register')}
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
                            <label className="form-label" htmlFor="login-id">{t('login.label.identifier')}</label>
                            <input
                                id="login-id"
                                type="text"
                                inputMode="email"
                                className="form-input"
                                placeholder={t('login.placeholder.identifier')}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete="username"
                                aria-invalid={error ? true : undefined}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="login-password">{t('login.label.password')}</label>
                            <input
                                id="login-password"
                                type="password"
                                className="form-input"
                                placeholder={t('login.placeholder.password')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                aria-invalid={error ? true : undefined}
                            />
                        </div>

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? t('login.button.loginLoading') : t('login.button.login')}
                        </Button>

                        <button type="button" className="forgot-link" onClick={() => handleTabSwitch('forgot')}>
                            {t('login.link.forgot')}
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
                            <label className="form-label" htmlFor="reg-username">{t('login.label.usernameRequired')}</label>
                            <input
                                id="reg-username"
                                type="text"
                                className="form-input"
                                placeholder={t('login.placeholder.username')}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                aria-invalid={error ? true : undefined}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-email">{t('login.label.emailRequired')}</label>
                            <input
                                id="reg-email"
                                type="email"
                                className="form-input"
                                placeholder={t('login.placeholder.email')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-phone">{t('login.label.phone')}</label>
                            <input
                                id="reg-phone"
                                type="tel"
                                className="form-input"
                                placeholder={t('login.placeholder.phone')}
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                autoComplete="tel"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-password">{t('login.label.passwordRequired')}</label>
                            <input
                                id="reg-password"
                                type="password"
                                className="form-input"
                                placeholder={t('login.placeholder.passwordMin')}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                                aria-invalid={error ? true : undefined}
                            />
                        </div>

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? t('login.button.registerLoading') : t('login.button.register')}
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
                            {t('login.forgot.desc')}
                        </p>

                        <div className="form-group">
                            <label className="form-label" htmlFor="forgot-email">{t('login.label.forgotEmail')}</label>
                            <input
                                id="forgot-email"
                                type="email"
                                className="form-input"
                                placeholder={t('login.placeholder.email')}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
                            {loading ? t('login.button.sendLoading') : t('login.button.sendReset')}
                        </Button>

                        <button type="button" className="forgot-link" onClick={() => handleTabSwitch('login')}>
                            {t('login.link.backToLogin')}
                        </button>
                    </form>
                )}

                <p className="login-footer text-muted text-xs">
                    {t('login.footer')}
                </p>
            </div>
        </div>
    )
}
