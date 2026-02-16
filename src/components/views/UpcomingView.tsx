import { useUpcomingTasks } from '@/hooks/useTasks'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { useState, useMemo } from 'react'
import { format, addDays, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Task } from '@/lib/types'
import { UPCOMING_DAYS } from '@/lib/constants'

export function UpcomingView() {
  const { data: tasks = [], isLoading } = useUpcomingTasks(UPCOMING_DAYS)
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

  const groupedTasks = useMemo(() => {
    const groups: { date: Date; label: string; tasks: Task[] }[] = []
    const today = startOfDay(new Date())

    for (let i = 0; i < UPCOMING_DAYS; i++) {
      const date = addDays(today, i)
      const dayTasks = tasks.filter(
        (t) => t.due_date && isSameDay(new Date(t.due_date), date) && !t.is_completed,
      )

      if (dayTasks.length > 0) {
        let label: string
        if (i === 0) label = 'Hoy'
        else if (i === 1) label = 'Ma\u00f1ana'
        else label = format(date, "EEEE d 'de' MMMM", { locale: es })

        groups.push({ date, label, tasks: dayTasks })
      }
    }

    return groups
  }, [tasks])

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
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Pr\u00f3ximos
        </h1>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Pr\u00f3ximos {UPCOMING_DAYS} d\u00edas
        </p>
      </div>

      {groupedTasks.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-4xl">{'\uD83D\uDCC5'}</p>
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Sin tareas pr\u00f3ximas
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tienes tareas programadas para los pr\u00f3ximos {UPCOMING_DAYS} d\u00edas
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedTasks.map(({ date, label, tasks: dayTasks }) => (
            <div key={date.toISOString()}>
              <h2
                className="mb-2 text-sm font-semibold capitalize"
                style={{ color: 'var(--text-primary)' }}
              >
                {label}
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </h2>
              <div
                className="divide-y rounded-lg border"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                {dayTasks.map((task) => (
                  <TaskItem key={task.id} task={task} onEdit={handleEditTask} showProject />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskEditor open={editorOpen} onClose={handleCloseEditor} task={editingTask} />
    </div>
  )
}
