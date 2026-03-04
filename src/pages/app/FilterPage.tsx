import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Filter as FilterIcon, ListChecks, Pencil } from 'lucide-react'
import { useFilter } from '@/hooks/useFilters'
import { useAllUserTasks, useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useLabels, useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useProjects } from '@/hooks/useProjects'
import { filterQueryEngine } from '@/services/filterService'
import { TaskItem } from '@/components/tasks/TaskItem'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { FilterEditor } from '@/components/filters/FilterEditor'
import { useUIStore } from '@/stores/uiStore'

export default function FilterPage() {
  const { filterId = '' } = useParams()
  const { data: filter, isLoading: filterLoading } = useFilter(filterId)
  const { data: allTasks = [], isLoading: tasksLoading } = useAllUserTasks()
  const { data: labels = [] } = useLabels()
  const { data: projects = [] } = useProjects()
  const { data: taskLabelsMap = new Map() } = useAllTaskLabelsMap()
  const { showConfirmDialog } = useUIStore()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const [editorOpen, setEditorOpen] = useState(false)

  const isLoading = filterLoading || tasksLoading

  const ctx = { labels, projects, taskLabelsMap }

  let filteredTasks = allTasks
  let parseError: string | null = null
  if (filter?.query) {
    try {
      filteredTasks = filterQueryEngine.run(filter.query, allTasks, ctx)
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Error al ejecutar el filtro'
      filteredTasks = []
    }
  }

  const { isSelectMode, selectedIds, enter, exit, toggle, selectAll, clearAll, allSelected } =
    useBulkSelection(filteredTasks)

  const handleBulkDelete = () => {
    showConfirmDialog({
      title: `¿Eliminar ${selectedIds.size} ${selectedIds.size === 1 ? 'tarea' : 'tareas'}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await Promise.all(Array.from(selectedIds).map((id) => deleteTask.mutateAsync(id)))
        exit()
      },
    })
  }

  const handleBulkMoveProject = async (projectId: string, sectionId: string | null) => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        updateTask.mutateAsync({ id, updates: { project_id: projectId, section_id: sectionId } }),
      ),
    )
    exit()
  }

  const handleBulkPriority = async (priority: 1 | 2 | 3 | 4) => {
    await Promise.all(
      Array.from(selectedIds).map((id) => updateTask.mutateAsync({ id, updates: { priority } })),
    )
    exit()
  }

  const handleBulkDueDate = async (date: string | null) => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        updateTask.mutateAsync({ id, updates: { due_date: date } }),
      ),
    )
    exit()
  }

  if (!filter && !isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Filtro no encontrado.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: (filter?.color ?? '#6B7280') + '22' }}
        >
          <FilterIcon size={16} style={{ color: filter?.color }} />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {filter?.name}
          </h1>
          <span
            className="text-xs"
            style={{
              color: 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {filter?.query}
          </span>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="rounded-lg p-2 transition-colors hover-bg-hover"
          style={{ color: 'var(--text-secondary)' }}
          title="Editar filtro"
        >
          <Pencil size={16} />
        </button>
        {!isSelectMode && filteredTasks.length > 0 && (
          <button
            onClick={enter}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover-bg-hover"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <ListChecks size={14} />
            Seleccionar
          </button>
        )}
      </div>

      {/* Task count */}
      <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>
        {filteredTasks.length} {filteredTasks.length === 1 ? 'tarea' : 'tareas'}
      </p>

      {parseError && (
        <div
          className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{
            borderColor: '#EC1E2A',
            backgroundColor: 'rgba(236,30,42,0.08)',
            color: '#EC1E2A',
          }}
        >
          Error en la consulta: {parseError}
        </div>
      )}

      {filteredTasks.length === 0 && !parseError ? (
        <div className="py-12 text-center">
          <FilterIcon size={40} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            No hay tareas que coincidan
          </p>
        </div>
      ) : (
        <div
          className="divide-y rounded-lg border"
          style={{ borderColor: 'var(--border-secondary)' }}
        >
          {filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              labels={taskLabelsMap.get(task.id)}
              showProject
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(task.id)}
              onToggleSelect={toggle}
            />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredTasks.length}
          allSelected={allSelected}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onExit={exit}
          onDelete={handleBulkDelete}
          onMoveToProject={handleBulkMoveProject}
          onChangePriority={handleBulkPriority}
          onChangeDueDate={handleBulkDueDate}
        />
      )}

      <FilterEditor open={editorOpen} onClose={() => setEditorOpen(false)} filter={filter} />
    </div>
  )
}
