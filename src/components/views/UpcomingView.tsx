import { useState, useMemo } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Plus, CalendarDays, ListChecks } from 'lucide-react'
import { useUpcomingTasks, useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useUpcomingCalendarEvents } from '@/hooks/useCalendarEvents'
import {
  useHabits,
  useHabitCompletions,
  useHabitSchedules,
  useToggleHabitCompletion,
} from '@/hooks/useHabits'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { CalendarEventItem } from '@/components/common/CalendarEventItem'
import { HabitItem } from '@/components/habits/HabitItem'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { ViewOptionsBar } from './ViewOptionsBar'
import { CalendarView } from './CalendarView'
import { DateBoardView } from './DateBoardView'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useUIStore } from '@/stores/uiStore'
import { applyViewFilters, applyViewSort } from '@/lib/viewUtils'
import { habitAppearsOnDate } from '@/lib/habitUtils'
import { format, addDays, isSameDay, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { parseLocalDate } from '@/lib/utils'
import type { Task, CalendarEvent } from '@/lib/types'

const VIEW_ID = 'upcoming'

export function UpcomingView() {
  const isMobile = useIsMobile()
  const { getViewOptions, showConfirmDialog } = useUIStore()
  const opts = getViewOptions(VIEW_ID)
  const upcomingDays = opts.upcomingDays ?? 30

  const { data: tasks = [], isLoading, isError } = useUpcomingTasks(upcomingDays)
  const { data: labelsMap } = useAllTaskLabelsMap()
  const { data: calendarEvents = [] } = useUpcomingCalendarEvents(upcomingDays)
  const { data: habits = [] } = useHabits()
  const upcomingFrom = format(startOfDay(new Date()), 'yyyy-MM-dd')
  const upcomingTo = format(addDays(new Date(), upcomingDays), 'yyyy-MM-dd')
  const { data: habitCompletions = [] } = useHabitCompletions(upcomingFrom, upcomingTo)
  const { data: habitSchedules = [] } = useHabitSchedules(upcomingFrom, upcomingTo)
  const toggleHabitCompletion = useToggleHabitCompletion()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined)
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

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

  const groupedDays = useMemo(() => {
    const groups: {
      date: Date
      label: string
      tasks: Task[]
      events: CalendarEvent[]
      habits: typeof habits
    }[] = []
    const today = startOfDay(new Date())

    for (let i = 0; i < upcomingDays; i++) {
      const date = addDays(today, i)
      const dayTasks = visibleTasks.filter(
        (t) => t.due_date && isSameDay(parseLocalDate(t.due_date), date),
      )
      const dayEvents = calendarEvents.filter((e) => isSameDay(e.start, date))
      const dayHabits =
        (opts.showHabits ?? true) ? habits.filter((h) => habitAppearsOnDate(h, date)) : []

      if (dayTasks.length > 0 || dayEvents.length > 0 || dayHabits.length > 0) {
        let label: string
        if (i === 0) label = 'Hoy'
        else if (i === 1) label = 'Mañana'
        else label = format(date, "EEEE d 'de' MMMM", { locale: es })

        groups.push({ date, label, tasks: dayTasks, events: dayEvents, habits: dayHabits })
      }
    }

    return groups
  }, [visibleTasks, calendarEvents, habits, upcomingDays])

  // Bulk selection
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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Error al cargar las tareas. Intentá de nuevo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-medium px-4 py-2 rounded-lg"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          Recargar
        </button>
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
          showFutureRecurrences={opts.showFutureRecurrences}
          showCompleted={opts.showCompleted}
          showHabits={opts.showHabits ?? true}
        />
      )
    }

    // Panel / Board view — columns = days
    if (opts.viewStyle === 'panel') {
      return <DateBoardView tasks={visibleTasks} days={upcomingDays} onAddTask={handleAddTask} />
    }

    // List view (default)
    if (groupedDays.length === 0) {
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
        {groupedDays.map(
          ({ date, label, tasks: dayTasks, events: dayEvents, habits: dayHabits }) => (
            <div key={date.toISOString()}>
              <div className="mb-2 flex items-center justify-between group">
                <h2
                  className="text-sm font-semibold capitalize"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {label}
                  {dayTasks.length > 0 && (
                    <span
                      className="ml-2 text-xs font-normal"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  )}
                  {dayEvents.length > 0 && (
                    <span
                      className="ml-1 text-xs font-normal"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      · {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  )}
                  {dayHabits.length > 0 && (
                    <span
                      className="ml-1 text-xs font-normal"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      · {dayHabits.length} {dayHabits.length === 1 ? 'hábito' : 'hábitos'}
                    </span>
                  )}
                </h2>
                {!isSelectMode && (
                  <button
                    onClick={() => handleAddTask(format(date, 'yyyy-MM-dd'))}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all opacity-0 group-hover:opacity-100 hover-bg-hover"
                    style={{ color: 'var(--text-muted)' }}
                    title={`Agregar tarea para ${label}`}
                  >
                    <Plus size={13} />
                  </button>
                )}
              </div>
              <div
                className="divide-y rounded-lg border overflow-hidden"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                {dayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    showProject
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(task.id)}
                    onToggleSelect={toggle}
                  />
                ))}
                {dayEvents.map((event) => (
                  <CalendarEventItem key={event.id} event={event} />
                ))}
                {dayHabits.map((habit) => (
                  <HabitItem
                    key={habit.id}
                    habit={habit}
                    completions={habitCompletions}
                    schedules={habitSchedules}
                    date={date}
                    onToggle={(habitId, d) => toggleHabitCompletion.mutate({ habitId, date: d })}
                    isPending={toggleHabitCompletion.isPending}
                  />
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold md:text-xl" style={{ color: 'var(--text-primary)' }}>
            Próximos
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Próximos {upcomingDays} días
          </p>
        </div>
        <div className="flex items-center gap-2">
          {opts.viewStyle === 'list' && !isSelectMode && visibleTasks.length > 0 && (
            <button
              onClick={enter}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover-bg-hover"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            >
              <ListChecks size={14} />
              Seleccionar
            </button>
          )}
          <ViewOptionsBar
            viewId={VIEW_ID}
            showUpcomingDays
            availableCalendarModes={isMobile ? ['day', 'month'] : ['week', '4days', 'month']}
            showHabitsToggle
          />
        </div>
      </div>

      {renderContent()}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultDate={defaultDate}
      />

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
