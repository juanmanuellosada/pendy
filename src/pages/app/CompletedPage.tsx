import { CheckCircle2 } from 'lucide-react'
import { useCompletedTasks } from '@/hooks/useTasks'
import { TaskItem } from '@/components/tasks/TaskItem'

export default function CompletedPage() {
  const { data: tasks = [], isLoading } = useCompletedTasks()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Completado
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {tasks.length} {tasks.length === 1 ? 'tarea completada' : 'tareas completadas'}
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <CheckCircle2 size={40} style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay tareas completadas
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
