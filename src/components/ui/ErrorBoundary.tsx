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
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback

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
                    <span style={{ fontSize: '3rem' }}>😿</span>
                    <h2 style={{ margin: 0, color: 'var(--color-text-primary)' }}>页面出错了</h2>
                    <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        {this.state.error?.message || '发生了未知错误'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <Button variant="primary" onClick={this.handleReset}>重试</Button>
                        <Button variant="secondary" onClick={() => window.location.reload()}>刷新页面</Button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
