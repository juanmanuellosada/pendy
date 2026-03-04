import { TaskItem } from './TaskItem'
import type { Task } from '@/lib/types'

interface TaskListProps {
  tasks: Task[]
  onEditTask?: (task: Task) => void
  showProject?: boolean
  emptyMessage?: string
}

export function TaskList({ tasks, onEditTask, showProject, emptyMessage }: TaskListProps) {
  const pendingTasks = tasks.filter((t) => !t.is_completed)
  const completedTasks = tasks.filter((t) => t.is_completed)

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage || 'No hay tareas'}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
      {pendingTasks.map((task) => (
        <TaskItem key={task.id} task={task} onEdit={onEditTask} showProject={showProject} />
      ))}
      {completedTasks.length > 0 && (
        <div className="pt-4">
          <p
            className="px-3 pb-2 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Completadas ({completedTasks.length})
          </p>
          {completedTasks.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={onEditTask} showProject={showProject} />
          ))}
        </div>
      )}
    </div>
  )
}
