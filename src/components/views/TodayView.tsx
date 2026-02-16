import { Plus } from 'lucide-react'
import { useTodayTasks } from '@/hooks/useTasks'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { isOverdue } from '@/lib/utils'
import { TaskItem } from '@/components/tasks/TaskItem'
import type { Task } from '@/lib/types'

export function TodayView() {
  const { data: tasks = [], isLoading } = useTodayTasks()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const today = new Date()
  const todayStr = format(today, "EEEE d 'de' MMMM", { locale: es })

  const overdueTasks = tasks.filter(
    (t) => t.due_date && isOverdue(t.due_date) && !t.is_completed,
  )
  const todayTasks = tasks.filter(
    (t) => t.due_date && !isOverdue(t.due_date) && !t.is_completed,
  )
  const completedTasks = tasks.filter((t) => t.is_completed)

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
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Hoy
          </h1>
          <p className="mt-0.5 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
            {todayStr}
          </p>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: '#EC1E2A' }}
        >
          <Plus size={16} />
          Agregar tarea
        </button>
      </div>

      {/* Overdue section */}
      {overdueTasks.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-red-500">
            Atrasadas ({overdueTasks.length})
          </h2>
          <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
            {overdueTasks.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={handleEditTask} showProject />
            ))}
          </div>
        </div>
      )}

      {/* Today section */}
      <div>
        {todayTasks.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
            {todayTasks.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={handleEditTask} showProject />
            ))}
          </div>
        )}
      </div>

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div className="mt-6">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Completadas ({completedTasks.length})
          </p>
          <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
            {completedTasks.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={handleEditTask} showProject />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-4xl">{'\uD83C\uDF89'}</p>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {'\u00a1'}Todo listo por hoy!
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tienes tareas pendientes para hoy
          </p>
        </div>
      )}

      <TaskEditor open={editorOpen} onClose={handleCloseEditor} task={editingTask} />
    </div>
  )
}
