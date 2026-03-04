import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { addDays, startOfDay, isSameDay, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useUpdateTask } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskItem } from '@/components/tasks/TaskItem'
import { parseLocalDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'

interface DateBoardViewProps {
  tasks: Task[]
  days: number
  onAddTask: (dateStr: string) => void
}

export function DateBoardView({ tasks, days, onAddTask }: DateBoardViewProps) {
  const { data: labelsMap } = useAllTaskLabelsMap()
  const updateTask = useUpdateTask()
  const today = useMemo(() => startOfDay(new Date()), [])

  const columns = useMemo(() => {
    const cols: { date: Date; dateStr: string; label: string; tasks: Task[] }[] = []

    for (let i = 0; i < days; i++) {
      const date = addDays(today, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayTasks = tasks.filter(
        (t) => t.due_date && isSameDay(parseLocalDate(t.due_date), date) && !t.is_completed,
      )

      let label: string
      if (i === 0) label = 'Hoy'
      else if (i === 1) label = 'Mañana'
      else label = format(date, 'EEE d', { locale: es })

      cols.push({ date, dateStr, label, tasks: dayTasks })
    }

    // Add "Sin fecha" column for tasks without due_date
    const noDateTasks = tasks.filter((t) => !t.due_date && !t.is_completed)
    if (noDateTasks.length > 0) {
      cols.push({
        date: new Date(0),
        dateStr: '',
        label: 'Sin fecha',
        tasks: noDateTasks,
      })
    }

    return cols
  }, [tasks, days, today])

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId && dateStr) {
      updateTask.mutate({ id: taskId, updates: { due_date: dateStr || null } })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <DateColumn
          key={col.dateStr || '__nodate__'}
          column={col}
          labelsMap={labelsMap}
          onAddTask={() => col.dateStr && onAddTask(col.dateStr)}
          onDrop={(e) => handleDrop(e, col.dateStr)}
          onDragOver={handleDragOver}
        />
      ))}
    </div>
  )
}

/* ── Date Column ─────────────────────────────────────── */

function DateColumn({
  column,
  labelsMap,
  onAddTask,
  onDrop,
  onDragOver,
}: {
  column: { date: Date; dateStr: string; label: string; tasks: Task[] }
  labelsMap: Map<string, import('@/lib/types').Label[]> | undefined
  onAddTask: () => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const isToday = column.label === 'Hoy'

  return (
    <div
      className="flex flex-shrink-0 flex-col rounded-xl transition-colors w-[280px]"
      style={{
        backgroundColor: isOver ? 'var(--bg-active)' : 'var(--bg-secondary)',
      }}
      onDragOver={(e) => {
        onDragOver(e)
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        onDrop(e)
        setIsOver(false)
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3
            className={cn('text-sm font-semibold capitalize')}
            style={{ color: isToday ? 'var(--color-accent)' : 'var(--text-primary)' }}
          >
            {column.label}
          </h3>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {column.tasks.length}
          </span>
        </div>

        {column.dateStr && (
          <button
            onClick={onAddTask}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Agregar tarea"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-1 px-2 pb-2 min-h-[60px]">
        {column.tasks.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg py-8 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Sin tareas
          </div>
        ) : (
          column.tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', task.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              className="rounded-lg border cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-secondary)',
              }}
            >
              <TaskItem task={task} labels={labelsMap?.get(task.id)} compact />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
