import { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'

interface LinkDialogProps {
  open: boolean
  initialUrl: string
  initialText?: string
  onSubmit: (url: string, text?: string) => void
  onClose: () => void
}

export function LinkDialog({ open, initialUrl, initialText, onSubmit, onClose }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl)
  const [text, setText] = useState(initialText ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const showText = initialText !== undefined

  useEffect(() => {
    if (open) {
      setUrl(initialUrl)
      setText(initialText ?? '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, initialUrl, initialText])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(url.trim(), showText ? text.trim() : undefined)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30 animate-fade-backdrop" onClick={onClose} />
      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl border p-5 shadow-lg animate-scale-in"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {initialUrl ? 'Editar enlace' : 'Insertar enlace'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Text field (shown when editing existing link) */}
          {showText && (
            <>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Texto
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Texto del enlace"
                className="mb-3 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </>
          )}

          <label
            className="mb-1.5 block text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            URL
          </label>
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ejemplo.com"
            className="mb-4 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-blue-500/30"
            style={{
              borderColor: 'var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
            }}
          />
          <div className="flex items-center justify-end gap-2">
            {initialUrl && (
              <button
                type="button"
                onClick={() => onSubmit('', undefined)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--color-accent)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Quitar enlace
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-lg px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
