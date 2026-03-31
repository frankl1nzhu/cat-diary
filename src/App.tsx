import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSession, updatePassword } from './lib/auth'
import { initAuth } from './stores/useAuthStore'
import { initCatStore } from './stores/useCatStore'
import { startOfflineSync } from './lib/offlineQueue'
import { prefetchAllRoutesOnIdle } from './lib/prefetch'
import { enablePushNotifications, isStandaloneDisplayMode } from './lib/pushNotifications'
import { savePushSubscription } from './lib/pushServer'
import { AppLayout } from './components/layout/AppLayout'
import { ToastViewport } from './components/ui/ToastViewport'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { Modal } from './components/ui/Modal'
import { Button } from './components/ui/Button'
import { useToastStore } from './stores/useToastStore'
import { getErrorMessage } from './lib/errorMessage'
import { STORAGE_KEYS } from './lib/constants'
import './App.css'

// Route-level code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const LogPage = lazy(() => import('./pages/LogPage').then(m => ({ default: m.LogPage })))
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })))

function PageLoader() {
  return (
    <div className="loading-screen">
      <div className="loading-cat">🐱</div>
      <div className="loading-dots">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
      <p className="text-secondary text-sm">加载中…</p>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession()

  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PasswordResetModal() {
  const { isPasswordRecovery, clearPasswordRecovery } = useSession()
  const pushToast = useToastStore((s) => s.pushToast)
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (newPwd.length < 6) { setError('密码至少6位'); return }
    if (newPwd !== confirmPwd) { setError('两次输入的密码不一致'); return }
    setSaving(true)
    try {
      await updatePassword(newPwd)
      pushToast('success', '密码已重置')
      clearPasswordRecovery()
      setNewPwd('')
      setConfirmPwd('')
    } catch (err) {
      setError(getErrorMessage(err, '密码重置失败'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isPasswordRecovery} onClose={clearPasswordRecovery} title="🔒 重置密码">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-danger)' }}>
            ⚠️ {error}
          </div>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="reset-new-pwd">新密码</label>
          <input id="reset-new-pwd" type="password" className="form-input" placeholder="至少6位" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" aria-invalid={error ? true : undefined} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-confirm-pwd">确认新密码</label>
          <input id="reset-confirm-pwd" type="password" className="form-input" placeholder="再次输入新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" aria-invalid={error ? true : undefined} />
        </div>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '确认重置'}
        </Button>
      </div>
    </Modal>
  )
}

export default function App() {
  const { user } = useSession()

  // Initialize auth & cat stores once at app startup (single subscription for the entire app)
  useEffect(() => {
    const cleanupAuth = initAuth()
    const cleanupCat = initCatStore()
    const cleanupOffline = startOfflineSync()
    prefetchAllRoutesOnIdle()
    return () => {
      cleanupAuth()
      cleanupCat()
      cleanupOffline()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return
    if (!isStandaloneDisplayMode()) return
    if (Notification.permission !== 'default') return

    const promptKey = STORAGE_KEYS.AUTO_PUSH_PROMPT
    if (sessionStorage.getItem(promptKey)) return
    sessionStorage.setItem(promptKey, '1')

    enablePushNotifications()
      .then(async (result) => {
        if (result.ok && 'subscribed' in result && result.subscribed && 'subscription' in result && result.subscription) {
          await savePushSubscription(user.id, result.subscription).catch(() => { })
        }
      })
      .catch(() => { })
  }, [user])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="log" element={<ErrorBoundary><LogPage /></ErrorBoundary>} />
              <Route path="stats" element={<ErrorBoundary><StatsPage /></ErrorBoundary>} />
              <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <PasswordResetModal />
      <ToastViewport />
    </BrowserRouter>
  )
}
