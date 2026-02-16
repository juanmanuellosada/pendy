import { Plus } from 'lucide-react'
import { useInboxTasks } from '@/hooks/useTasks'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { useInboxProject } from '@/hooks/useProjects'
import { useState } from 'react'
import type { Task } from '@/lib/types'

export function InboxView() {
  const { data: tasks = [], isLoading } = useInboxTasks()
  const { data: inboxProject } = useInboxProject()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setEditorOpen(true)
  }

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
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
      <div className="mb-6 flex items-center justify-between">
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

      <TaskList
        tasks={tasks}
        onEditTask={handleEditTask}
        emptyMessage="Tu bandeja de entrada est\u00e1 vac\u00eda. \u00a1Bien hecho!"
      />

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultProjectId={inboxProject?.id}
      />
    </div>
  )
}
