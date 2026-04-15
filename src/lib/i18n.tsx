/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'zh' | 'en'

type I18nContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
}

const LANGUAGE_STORAGE_KEY = 'cat_diary_language'

type TranslationMap = {
  [key: string]: string
}

const translations: Record<AppLanguage, TranslationMap> = {
  zh: {
    'language.aria': '切换语言',
    'language.switchToEnglish': '切换到英文',
    'language.switchToChinese': '切换到中文',

    'app.loading': '加载中…',

    'reset.title': '🔒 重置密码',
    'reset.error.minLength': '密码至少6位',
    'reset.error.mismatch': '两次输入的密码不一致',
    'reset.toast.success': '密码已重置',
    'reset.error.fallback': '密码重置失败',
    'reset.newPassword.label': '新密码',
    'reset.newPassword.placeholder': '至少6位',
    'reset.confirmPassword.label': '确认新密码',
    'reset.confirmPassword.placeholder': '再次输入新密码',
    'reset.button.saving': '保存中...',
    'reset.button.confirm': '确认重置',

    'layout.skipToContent': '跳转到主要内容',
    'layout.offlineBanner': '📡 当前离线，暂不可提交新记录',
    'layout.scrollTop': '回到顶部',

    'cat.select': '选择猫咪',
    'cat.none': '暂无猫咪',
    'cat.add': '新增猫咪',

    'nav.home': '首页',
    'nav.log': '记录',
    'nav.stats': '统计',
    'nav.settings': '设置',

    'quick.close': '关闭快速记录',
    'quick.menu': '快速记录菜单',
    'quick.title': '快速记录',
    'quick.open': '快速记录',
    'quick.writeDiary': '写日记',
    'quick.logPoop': '记便便',
    'quick.logFeed': '记喂食',
    'quick.logWeight': '记体重',
    'quick.addInventory': '新增库存',
    'quick.healthRecord': '健康记录',
    'quick.expiryReminder': '过期提醒',

    'login.tab.login': '登录',
    'login.tab.register': '注册',
    'login.error.signIn': '登录失败，请检查账号和密码',
    'login.error.usernameRequired': '请输入用户名',
    'login.error.usernameMin': '用户名至少2个字符',
    'login.error.passwordMin': '密码至少6位',
    'login.toast.registerSuccess': '注册成功！请查收验证邮件',
    'login.error.register': '注册失败，请稍后重试',
    'login.error.emailRequired': '请输入邮箱',
    'login.toast.resetSent': '重置邮件已发送，请查收',
    'login.error.resetSend': '发送失败，请稍后重试',
    'login.label.identifier': '邮箱 / 用户名 / 手机号',
    'login.placeholder.identifier': '输入邮箱、用户名或手机号',
    'login.label.password': '密码',
    'login.placeholder.password': '输入密码',
    'login.button.loginLoading': '登录中...',
    'login.button.login': '登录 🐾',
    'login.link.forgot': '忘记密码？',
    'login.label.usernameRequired': '用户名 *',
    'login.placeholder.username': '唯一用户名',
    'login.label.emailRequired': '邮箱 *',
    'login.placeholder.email': 'your@email.com',
    'login.label.phone': '手机号',
    'login.placeholder.phone': '可选，如 13812345678',
    'login.label.passwordRequired': '密码 *',
    'login.placeholder.passwordMin': '至少6位',
    'login.button.registerLoading': '注册中...',
    'login.button.register': '注册 🐾',
    'login.forgot.desc': '输入注册邮箱，我们将发送重置密码链接。',
    'login.label.forgotEmail': '邮箱',
    'login.button.sendLoading': '发送中...',
    'login.button.sendReset': '发送重置邮件',
    'login.link.backToLogin': '返回登录',
    'login.footer': '极简记录，实时同步 ✨',
  },
  en: {
    'language.aria': 'Switch language',
    'language.switchToEnglish': 'Switch to English',
    'language.switchToChinese': 'Switch to Chinese',

    'app.loading': 'Loading…',

    'reset.title': '🔒 Reset Password',
    'reset.error.minLength': 'Password must be at least 6 characters',
    'reset.error.mismatch': 'The two passwords do not match',
    'reset.toast.success': 'Password has been reset',
    'reset.error.fallback': 'Password reset failed',
    'reset.newPassword.label': 'New password',
    'reset.newPassword.placeholder': 'At least 6 characters',
    'reset.confirmPassword.label': 'Confirm new password',
    'reset.confirmPassword.placeholder': 'Re-enter your new password',
    'reset.button.saving': 'Saving...',
    'reset.button.confirm': 'Confirm reset',

    'layout.skipToContent': 'Skip to main content',
    'layout.offlineBanner': '📡 You are offline. New records cannot be submitted now.',
    'layout.scrollTop': 'Back to top',

    'cat.select': 'Select cat',
    'cat.none': 'No cats yet',
    'cat.add': 'Add cat',

    'nav.home': 'Home',
    'nav.log': 'Log',
    'nav.stats': 'Stats',
    'nav.settings': 'Settings',

    'quick.close': 'Close quick actions',
    'quick.menu': 'Quick action menu',
    'quick.title': 'Quick Actions',
    'quick.open': 'Open quick actions',
    'quick.writeDiary': 'Write diary',
    'quick.logPoop': 'Log poop',
    'quick.logFeed': 'Log feeding',
    'quick.logWeight': 'Log weight',
    'quick.addInventory': 'Add inventory',
    'quick.healthRecord': 'Health record',
    'quick.expiryReminder': 'Expiry reminder',

    'login.tab.login': 'Sign in',
    'login.tab.register': 'Sign up',
    'login.error.signIn': 'Sign in failed. Please check your account and password.',
    'login.error.usernameRequired': 'Please enter a username',
    'login.error.usernameMin': 'Username must be at least 2 characters',
    'login.error.passwordMin': 'Password must be at least 6 characters',
    'login.toast.registerSuccess': 'Registration successful! Please verify via email.',
    'login.error.register': 'Registration failed. Please try again later.',
    'login.error.emailRequired': 'Please enter your email',
    'login.toast.resetSent': 'Reset email sent. Please check your inbox.',
    'login.error.resetSend': 'Failed to send. Please try again later.',
    'login.label.identifier': 'Email / Username / Phone',
    'login.placeholder.identifier': 'Enter email, username, or phone',
    'login.label.password': 'Password',
    'login.placeholder.password': 'Enter password',
    'login.button.loginLoading': 'Signing in...',
    'login.button.login': 'Sign in 🐾',
    'login.link.forgot': 'Forgot password?',
    'login.label.usernameRequired': 'Username *',
    'login.placeholder.username': 'Unique username',
    'login.label.emailRequired': 'Email *',
    'login.placeholder.email': 'your@email.com',
    'login.label.phone': 'Phone',
    'login.placeholder.phone': 'Optional, e.g. +1 555 123 4567',
    'login.label.passwordRequired': 'Password *',
    'login.placeholder.passwordMin': 'At least 6 characters',
    'login.button.registerLoading': 'Signing up...',
    'login.button.register': 'Sign up 🐾',
    'login.forgot.desc': 'Enter your registration email and we will send a reset link.',
    'login.label.forgotEmail': 'Email',
    'login.button.sendLoading': 'Sending...',
    'login.button.sendReset': 'Send reset email',
    'login.link.backToLogin': 'Back to sign in',
    'login.footer': 'Simple logging, real-time sync ✨',
  },
}

export type TranslationKey = keyof typeof translations.zh

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

function getStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'zh'
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return saved === 'en' ? 'en' : 'zh'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => getStoredLanguage())

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'))
  }, [])

  const t = useCallback(
    (key: TranslationKey) => {
      return translations[language][key] || translations.zh[key] || key
    },
    [language],
  )

  const contextValue = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, toggleLanguage, t],
  )

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider')
  }
  return context
}
