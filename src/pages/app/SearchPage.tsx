import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { useSearchTasks } from '@/hooks/useTasks'
import { TaskItem } from '@/components/tasks/TaskItem'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: results = [], isLoading, isFetching } = useSearchTasks(query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Buscador
        </h1>

        {/* Search input */}
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tareas..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {query.trim().length < 2 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Search size={36} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Escribe al menos 2 caracteres para buscar
          </p>
        </div>
      ) : isLoading || isFetching ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin resultados para «{query}»
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </p>
          <div className="flex flex-col gap-0.5">
            {results.map((task) => (
              <TaskItem key={task.id} task={task} showProject />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
