import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Star, ListChecks, Check, ChevronRight, Filter } from 'lucide-react'
import { useFilters, useUpdateFilter, useDeleteFilter } from '@/hooks/useFilters'
import { useAllUserTasks } from '@/hooks/useTasks'
import { useLabels, useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useProjects } from '@/hooks/useProjects'
import { useUIStore } from '@/stores/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { FilterEditor } from '@/components/filters/FilterEditor'
import { filterQueryEngine } from '@/services/filterService'
import type { Filter as FilterType } from '@/lib/types'

export default function FiltersPage() {
  const navigate = useNavigate()
  useAuth()
  const { data: filters = [] } = useFilters()
  const updateFilter = useUpdateFilter()
  const deleteFilter = useDeleteFilter()
  const { showConfirmDialog } = useUIStore()

  const { data: allTasks = [] } = useAllUserTasks()
  const { data: labels = [] } = useLabels()
  const { data: projects = [] } = useProjects()
  const { data: taskLabelsMap = new Map() } = useAllTaskLabelsMap()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<FilterType | null>(null)

  const { isSelectMode, selectedIds, enter, exit, toggle, selectAll, clearAll, allSelected } =
    useBulkSelection(filters)

  const ctx = { labels, projects, taskLabelsMap }

  const getMatchCount = (query: string): number => {
    try {
      return filterQueryEngine.run(query, allTasks, ctx).length
    } catch {
      return 0
    }
  }

  const handleDelete = (id: string, name: string) => {
    showConfirmDialog({
      title: 'Eliminar filtro',
      message: `¿Eliminar el filtro «${name}»?`,
      confirmLabel: 'Eliminar',
      onConfirm: () => deleteFilter.mutate(id),
    })
  }

  const handleBulkDelete = () => {
    showConfirmDialog({
      title: `¿Eliminar ${selectedIds.size} ${selectedIds.size === 1 ? 'filtro' : 'filtros'}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await Promise.all(Array.from(selectedIds).map((id) => deleteFilter.mutateAsync(id)))
        exit()
      },
    })
  }

  const toggleFavorite = (id: string, current: boolean) => {
    updateFilter.mutate({ id, updates: { is_favorite: !current } })
  }

  const handleEdit = (filter: FilterType) => {
    setEditingFilter(filter)
    setEditorOpen(true)
  }

  const handleCreate = () => {
    setEditingFilter(null)
    setEditorOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Mis filtros
        </h1>
        <div className="flex items-center gap-2">
          {!isSelectMode && filters.length > 0 && (
            <button
              onClick={enter}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            >
              <ListChecks size={14} />
              Seleccionar
            </button>
          )}
        </div>
      </div>

      {/* Create button */}
      {!isSelectMode && (
        <button
          onClick={handleCreate}
          className="mb-6 flex w-full items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm transition-colors"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={16} />
          Crear filtro
        </button>
      )}

      {/* List */}
      {filters.length === 0 ? (
        <div className="py-12 text-center">
          <Filter size={40} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay filtros creados aún.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Los filtros te permiten encontrar tareas con consultas personalizadas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border" style={{ borderColor: 'var(--border-primary)' }}>
          {filters.map((filter, i) => {
            const isLast = i === filters.length - 1
            const isSelected = selectedIds.has(filter.id)
            const count = getMatchCount(filter.query)
            return (
              <div
                key={filter.id}
                className="group flex items-center gap-3 px-4 py-3 transition-colors"
                style={{
                  borderBottom: isLast ? 'none' : '1px solid var(--border-primary)',
                  backgroundColor: isSelected ? 'rgba(59,130,246,0.08)' : 'transparent',
                  cursor: isSelectMode ? 'default' : 'pointer',
                }}
                onClick={
                  isSelectMode
                    ? () => toggle(filter.id)
                    : () => navigate(`/app/filter/${filter.id}`)
                }
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSelected
                    ? 'rgba(59,130,246,0.08)'
                    : 'transparent'
                }}
              >
                {/* Checkbox or color dot */}
                {isSelectMode ? (
                  <div
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: isSelected ? 'var(--color-link)' : 'var(--border-primary)',
                      backgroundColor: isSelected ? 'var(--color-link)' : 'transparent',
                    }}
                  >
                    {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                ) : (
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: filter.color }}
                  />
                )}

                {/* Name + query preview */}
                <div className="min-w-0 flex-1">
                  <span className="block text-sm" style={{ color: 'var(--text-primary)' }}>
                    {filter.name}
                  </span>
                  <span
                    className="block truncate text-xs"
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {filter.query}
                  </span>
                </div>

                {/* Task count */}
                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {count}
                </span>

                {!isSelectMode && (
                  <ChevronRight
                    size={14}
                    className="flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
                    style={{ color: 'var(--text-muted)' }}
                  />
                )}

                {!isSelectMode && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(filter.id, filter.is_favorite)
                      }}
                      className="rounded p-1 transition-colors"
                      style={{ color: filter.is_favorite ? '#F59E0B' : 'var(--text-muted)' }}
                      title={filter.is_favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    >
                      <Star size={14} fill={filter.is_favorite ? '#F59E0B' : 'none'} />
                    </button>

                    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(filter)
                        }}
                        className="rounded p-1 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                        title="Editar filtro"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(filter.id, filter.name)
                        }}
                        className="rounded p-1"
                        style={{ color: 'var(--color-accent)' }}
                        title="Eliminar filtro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filters.length}
          allSelected={allSelected}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onExit={exit}
          onDelete={handleBulkDelete}
          itemLabel="filtro"
        />
      )}

      <FilterEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false)
          setEditingFilter(null)
        }}
        filter={editingFilter}
      />
    </div>
  )
}
