import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
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
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--bg-secondary, #f5f5f5)' }}
            >
              <AlertTriangle
                className="h-8 w-8"
                style={{ color: 'var(--color-warning, #F59E0B)' }}
              />
            </div>
            <div className="space-y-2">
              <h2
                className="text-xl font-semibold"
                style={{ color: 'var(--text-primary, #1a1a2e)' }}
              >
                Algo salió mal
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary, #6b7280)' }}>
                Ocurrió un error inesperado. Podés intentar de nuevo o recargar la página.
              </p>
            </div>
            {this.state.error && (
              <pre
                className="rounded-lg p-3 text-left text-xs overflow-auto max-h-32"
                style={{
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  color: 'var(--text-muted, #9ca3af)',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary, #f5f5f5)',
                  color: 'var(--text-primary, #1a1a2e)',
                }}
              >
                Intentar de nuevo
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
