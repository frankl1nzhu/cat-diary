import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSession, updatePassword } from './lib/auth'
import { AppLayout } from './components/layout/AppLayout'
import { ToastViewport } from './components/ui/ToastViewport'
import { Modal } from './components/ui/Modal'
import { Button } from './components/ui/Button'
import { useToastStore } from './stores/useToastStore'
import { getErrorMessage } from './lib/errorMessage'
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
          <input id="reset-new-pwd" type="password" className="form-input" placeholder="至少6位" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} autoComplete="new-password" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="reset-confirm-pwd">确认新密码</label>
          <input id="reset-confirm-pwd" type="password" className="form-input" placeholder="再次输入新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
        </div>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '确认重置'}
        </Button>
      </div>
    </Modal>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="log" element={<LogPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <PasswordResetModal />
      <ToastViewport />
    </BrowserRouter>
  )
}
