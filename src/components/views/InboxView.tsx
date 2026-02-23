import { Plus } from 'lucide-react'
import { useInboxTasks } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskGroup } from '@/components/tasks/TaskGroup'
import { ViewOptionsBar } from './ViewOptionsBar'
import { useInboxProject } from '@/hooks/useProjects'
import { useUIStore } from '@/stores/uiStore'
import { applyViewFilters, applyViewSort, groupTasks } from '@/lib/viewUtils'
import { useState, useMemo } from 'react'
import type { Task } from '@/lib/types'

const VIEW_ID = 'inbox'

export function InboxView() {
  const { data: tasks = [], isLoading } = useInboxTasks()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const { data: inboxProject } = useInboxProject()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const { getViewOptions } = useUIStore()
  const opts = getViewOptions(VIEW_ID)

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
  }

  const visibleTasks = useMemo(() => {
    let list = tasks
    if (!opts.showCompleted) list = list.filter((t) => !t.is_completed)
    list = applyViewFilters(list, opts, labelsMap)
    list = applyViewSort(list, opts)
    return list
  }, [tasks, opts, labelsMap])

  const groups = useMemo(
    () => groupTasks(visibleTasks, opts.groupBy, labelsMap),
    [visibleTasks, opts.groupBy, labelsMap],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Entrada
        </h1>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#EC1E2A' }}
        >
          <Plus size={16} />
          Agregar tarea
        </button>
      </div>

      <ViewOptionsBar viewId={VIEW_ID} />

      {visibleTasks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl">📥</p>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Tu bandeja de entrada está vacía. ¡Bien hecho!
          </p>
        </div>
      ) : opts.groupBy === 'none' ? (
        <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
          {visibleTasks.map((task) => (
            <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} />
          ))}
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <TaskGroup
              key={group.key}
              label={group.label}
              color={group.color}
              tasks={group.tasks}
              labelsMap={labelsMap}
            />
          ))}
        </div>
      )}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultProjectId={inboxProject?.id}
      />
    </div>
  )
}
