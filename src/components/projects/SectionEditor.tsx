import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Section } from '@/lib/types'

interface SectionEditorProps {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
  section?: Section | null
  shortcutKey?: string
}

export function SectionEditor({ open, onClose, onSave, section, shortcutKey }: SectionEditorProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(section?.name ?? '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, section])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {section ? 'Renombrar sección' : 'Nueva sección'}
            </h2>
            {!section && shortcutKey && (
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                title="Atajo de teclado"
              >
                {shortcutKey}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la sección"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#EC1E2A' }}
            >
              <span>{section ? 'Guardar' : 'Crear'}</span>
              {!section && shortcutKey && (
                <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">
                  {shortcutKey}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
