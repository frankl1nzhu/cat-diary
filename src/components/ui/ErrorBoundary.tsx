import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from './Button'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
    retryCount: number
}

type ErrorCategory = 'network' | 'chunk' | 'unknown'

function categorizeError(error: Error | null): ErrorCategory {
    if (!error) return 'unknown'
    const msg = error.message.toLowerCase()
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to load') || msg.includes('timeout') || msg.includes('cors')) {
        return 'network'
    }
    if (msg.includes('loading chunk') || msg.includes('loading css chunk') || msg.includes('dynamically imported module')) {
        return 'chunk'
    }
    return 'unknown'
}

const ERROR_MESSAGES: Record<ErrorCategory, { title: string; description: string; icon: string }> = {
    network: {
        title: '网络连接出错',
        description: '无法连接到服务器，请检查网络后重试',
        icon: '📡',
    },
    chunk: {
        title: '页面资源加载失败',
        description: '应用已更新，正在自动刷新…',
        icon: '🔄',
    },
    unknown: {
        title: '页面出错了',
        description: '发生了未知错误',
        icon: '😿',
    },
}

const MAX_AUTO_RETRY = 2
const AUTO_RETRY_DELAY = 1500

export class ErrorBoundary extends Component<Props, State> {
    private autoRetryTimer: ReturnType<typeof setTimeout> | null = null

    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null, retryCount: 0 }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo)

        const category = categorizeError(error)

        // Auto-reload for chunk loading failures (app update)
        if (category === 'chunk') {
            window.location.reload()
            return
        }

        // Auto-retry for network errors (up to MAX_AUTO_RETRY times)
        if (category === 'network' && this.state.retryCount < MAX_AUTO_RETRY) {
            this.autoRetryTimer = setTimeout(() => {
                this.setState((prev) => ({
                    hasError: false,
                    error: null,
                    retryCount: prev.retryCount + 1,
                }))
            }, AUTO_RETRY_DELAY)
        }
    }

    componentWillUnmount() {
        if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer)
    }

    handleReset = () => {
        if (this.autoRetryTimer) clearTimeout(this.autoRetryTimer)
        this.setState({ hasError: false, error: null, retryCount: 0 })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

            const category = categorizeError(this.state.error)
            const info = ERROR_MESSAGES[category]
            const isAutoRetrying = category === 'network' && this.state.retryCount < MAX_AUTO_RETRY

            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '2rem',
                    textAlign: 'center',
                    gap: '1rem',
                }}>
                    <span style={{ fontSize: '3rem' }}>{info.icon}</span>
                    <h2 style={{ margin: 0, color: 'var(--color-text)' }}>{info.title}</h2>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {isAutoRetrying
                            ? `自动重试中…（${this.state.retryCount + 1}/${MAX_AUTO_RETRY}）`
                            : info.description}
                    </p>
                    {!isAutoRetrying && (
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <Button variant="primary" onClick={this.handleReset}>重试</Button>
                            <Button variant="secondary" onClick={() => window.location.reload()}>刷新页面</Button>
                        </div>
                    )}
                </div>
            )
        }

        return this.props.children
    }
}
