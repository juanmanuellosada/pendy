import { useParams } from 'react-router-dom'
import { Tag, ListChecks } from 'lucide-react'
import { useLabels } from '@/hooks/useLabels'
import { useTasksByLabel, useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskItem } from '@/components/tasks/TaskItem'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useUIStore } from '@/stores/uiStore'

export default function LabelPage() {
  const { labelId = '' } = useParams()
  const { data: labels = [] } = useLabels()
  const { data: tasks = [], isLoading } = useTasksByLabel(labelId)
  const { data: labelsMap } = useAllTaskLabelsMap()
  const { showConfirmDialog } = useUIStore()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const label = labels.find((l) => l.id === labelId)

  const visibleTasks = tasks.filter((t) => !t.is_completed)

  const { isSelectMode, selectedIds, enter, exit, toggle, selectAll, clearAll, allSelected } =
    useBulkSelection(visibleTasks)

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

  if (!label && !isLoading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Etiqueta no encontrada.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: label?.color + '22' }}
        >
          <Tag size={16} style={{ color: label?.color }} />
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {label?.name}
          </h1>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {visibleTasks.length} {visibleTasks.length === 1 ? 'tarea' : 'tareas'}
          </span>
        </div>
        {!isSelectMode && visibleTasks.length > 0 && (
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

      {visibleTasks.length === 0 ? (
        <div className="py-12 text-center">
          <Tag size={40} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            No hay tareas con esta etiqueta
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border" style={{ borderColor: 'var(--border-secondary)' }}>
          {visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              labels={labelsMap?.get(task.id)}
              showProject
              isSelectMode={isSelectMode}
              isSelected={selectedIds.has(task.id)}
              onToggleSelect={() => toggle(task.id)}
            />
          ))}
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={visibleTasks.length}
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
    </div>
  )
}
