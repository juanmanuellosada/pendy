import { useState, useRef, useEffect } from 'react'
import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react'
import { filterQueryEngine } from '@/services/filterService'

interface FilterQueryInputProps {
  value: string
  onChange: (value: string) => void
  error?: string | null
}

const SYNTAX_HELP = `Campos disponibles:
  priority:1,2        Prioridad (1-4)
  due:today            Hoy
  due:tomorrow         Mañana
  due:overdue          Vencidas
  due:nodate           Sin fecha
  due:next7days        Próximos 7 días
  due:before:YYYY-MM-DD
  label:nombre         Por etiqueta
  project:nombre       Por proyecto
  completed:true/false
  search:texto         Buscar en título
  recurring:true/false

Operadores:
  &  AND    |  OR    !  NOT    ( )  Agrupar

Ejemplo:
  (priority:1 | priority:2) & due:next7days`

export function FilterQueryInput({ value, onChange, error }: FilterQueryInputProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const helpRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const displayError = error ?? validationError

  useEffect(() => {
    if (!value.trim()) {
      setValidationError(null)
      return
    }
    const err = filterQueryEngine.validate(value)
    setValidationError(err)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setShowHelp(false)
      }
    }
    if (showHelp) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHelp])

  return (
    <div className="relative">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="priority:1 & due:today"
          rows={2}
          className="w-full resize-none rounded-lg border px-3 py-2 pr-16 text-sm outline-none transition-colors"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '13px',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: displayError ? '#EC1E2A' : 'var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {value.trim() &&
            (displayError ? (
              <AlertCircle size={16} style={{ color: '#EC1E2A' }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: '#22C55E' }} />
            ))}
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="rounded p-0.5 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            title="Referencia de sintaxis"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {displayError && (
        <p className="mt-1 text-xs" style={{ color: '#EC1E2A' }}>
          {displayError}
        </p>
      )}

      {showHelp && (
        <div
          ref={helpRef}
          className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border p-3 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          <p className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            Referencia de sintaxis
          </p>
          <pre
            className="whitespace-pre-wrap text-[11px] leading-relaxed"
            style={{
              color: 'var(--text-secondary)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {SYNTAX_HELP}
          </pre>
        </div>
      )}
    </div>
  )
}
