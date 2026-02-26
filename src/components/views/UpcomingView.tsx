import { useState, useMemo } from 'react'
import { Plus, CalendarDays } from 'lucide-react'
import { useUpcomingTasks } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { ViewOptionsBar } from './ViewOptionsBar'
import { CalendarView } from './CalendarView'
import { DateBoardView } from './DateBoardView'
import { useUIStore } from '@/stores/uiStore'
import { applyViewFilters, applyViewSort } from '@/lib/viewUtils'
import { format, addDays, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseLocalDate } from '@/lib/utils'
import type { Task } from '@/lib/types'

const VIEW_ID = 'upcoming'

export function UpcomingView() {
  const { getViewOptions } = useUIStore()
  const opts = getViewOptions(VIEW_ID)
  const upcomingDays = opts.upcomingDays ?? 30

  const { data: tasks = [], isLoading } = useUpcomingTasks(upcomingDays)
  const { data: labelsMap } = useAllTaskLabelsMap()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
    setDefaultDate(undefined)
  }

  const handleAddTask = (dateStr?: string) => {
    setDefaultDate(dateStr)
    setEditorOpen(true)
  }

  const visibleTasks = useMemo(() => {
    let list = tasks
    if (!opts.showCompleted) list = list.filter((t) => !t.is_completed)
    list = applyViewFilters(list, opts, labelsMap)
    list = applyViewSort(list, opts)
    return list
  }, [tasks, opts, labelsMap])

  const groupedTasks = useMemo(() => {
    const groups: { date: Date; label: string; tasks: Task[] }[] = []
    const today = startOfDay(new Date())

    for (let i = 0; i < upcomingDays; i++) {
      const date = addDays(today, i)
      const dayTasks = visibleTasks.filter(
        (t) => t.due_date && isSameDay(parseLocalDate(t.due_date), date),
      )

      if (dayTasks.length > 0) {
        let label: string
        if (i === 0) label = 'Hoy'
        else if (i === 1) label = 'Mañana'
        else label = format(date, "EEEE d 'de' MMMM", { locale: es })

        groups.push({ date, label, tasks: dayTasks })
      }
    }

    return groups
  }, [visibleTasks, upcomingDays])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  const renderContent = () => {
    // Calendar view
    if (opts.viewStyle === 'calendar') {
      return (
        <CalendarView
          calendarMode={opts.calendarMode}
          onAddTask={handleAddTask}
        />
      )
    }

    // Panel / Board view — columns = days
    if (opts.viewStyle === 'panel') {
      return (
        <DateBoardView
          tasks={visibleTasks}
          days={upcomingDays}
          onAddTask={handleAddTask}
        />
      )
    }

    // List view (default)
    if (groupedTasks.length === 0) {
      return (
        <div className="py-12 text-center">
          <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Sin tareas próximas
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            No tienes tareas programadas para los próximos {upcomingDays} días
          </p>
          <button
            onClick={() => handleAddTask()}
            className="mt-4 flex items-center gap-2 mx-auto rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={15} />
            Agregar primera tarea
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {groupedTasks.map(({ date, label, tasks: dayTasks }) => (
          <div key={date.toISOString()}>
            <div className="mb-2 flex items-center justify-between group">
              <h2
                className="text-sm font-semibold capitalize"
                style={{ color: 'var(--text-primary)' }}
              >
                {label}
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                  {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                </span>
              </h2>
              <button
                onClick={() => handleAddTask(format(date, 'yyyy-MM-dd'))}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all opacity-0 group-hover:opacity-100"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title={`Agregar tarea para ${label}`}
              >
                <Plus size={13} />
              </button>
            </div>
            <div className="divide-y rounded-lg border" style={{ borderColor: 'var(--border-secondary)' }}>
              {dayTasks.map((task) => (
                <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} showProject />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Próximos
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Próximos {upcomingDays} días
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewOptionsBar viewId={VIEW_ID} showUpcomingDays availableCalendarModes={['week', '4days', 'month']} />
          <button
            onClick={() => handleAddTask()}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={16} />
            Agregar tarea
          </button>
        </div>
      </div>

      {renderContent()}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultDate={defaultDate}
      />
    </div>
  )
}
