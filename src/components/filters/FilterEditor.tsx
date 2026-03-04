import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { FilterQueryInput } from './FilterQueryInput'
import { ColorPicker } from '@/components/common/ColorPicker'
import { filterQueryEngine } from '@/services/filterService'
import { useCreateFilter, useUpdateFilter } from '@/hooks/useFilters'
import { useAllUserTasks } from '@/hooks/useTasks'
import { useLabels, useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useProjects } from '@/hooks/useProjects'
import type { Filter } from '@/lib/types'

interface FilterEditorProps {
  open: boolean
  onClose: () => void
  filter?: Filter | null
}

export function FilterEditor({ open, onClose, filter }: FilterEditorProps) {
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [color, setColor] = useState('#6B7280')

  const createFilter = useCreateFilter()
  const updateFilter = useUpdateFilter()

  const { data: allTasks = [] } = useAllUserTasks()
  const { data: labels = [] } = useLabels()
  const { data: projects = [] } = useProjects()
  const { data: taskLabelsMap = new Map() } = useAllTaskLabelsMap()

  const isEditing = !!filter

  useEffect(() => {
    if (open) {
      if (filter) {
        setName(filter.name)
        setQuery(filter.query)
        setColor(filter.color)
      } else {
        setName('')
        setQuery('')
        setColor('#6B7280')
      }
    }
  }, [open, filter])

  const validationError = query.trim() ? filterQueryEngine.validate(query) : null
  const isValid = name.trim() && query.trim() && !validationError

  // Preview: count matching tasks
  let matchCount = 0
  if (query.trim() && !validationError) {
    try {
      const ctx = { labels, projects, taskLabelsMap }
      matchCount = filterQueryEngine.run(query, allTasks, ctx).length
    } catch {
      // Ignore
    }
  }

  const handleSubmit = async () => {
    if (!isValid) return

    if (isEditing && filter) {
      await updateFilter.mutateAsync({
        id: filter.id,
        updates: { name: name.trim(), query: query.trim(), color },
      })
    } else {
      await createFilter.mutateAsync({
        name: name.trim(),
        query: query.trim(),
        color,
      })
    }
    onClose()
  }

  const isPending = createFilter.isPending || updateFilter.isPending

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-md rounded-xl border p-6 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? 'Editar filtro' : 'Nuevo filtro'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name + color */}
          <div className="flex items-center gap-2">
            <ColorPicker value={color} onChange={setColor} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del filtro..."
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
          </div>

          {/* Query */}
          <div>
            <label
              className="mb-1 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Consulta
            </label>
            <FilterQueryInput value={query} onChange={setQuery} />
          </div>

          {/* Preview */}
          {query.trim() && !validationError && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {matchCount} {matchCount === 1 ? 'tarea coincide' : 'tareas coinciden'}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#283B56' }}
            >
              {isEditing ? 'Guardar' : 'Crear filtro'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
