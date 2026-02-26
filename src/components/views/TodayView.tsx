import { Plus, PartyPopper } from 'lucide-react'
import { useTodayTasks } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskGroup } from '@/components/tasks/TaskGroup'
import { TodayCalendarView } from './TodayCalendarView'
import { ViewOptionsBar } from './ViewOptionsBar'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { isOverdue } from '@/lib/utils'
import { useUIStore } from '@/stores/uiStore'
import { applyViewFilters, applyViewSort, groupTasks } from '@/lib/viewUtils'
import type { Task } from '@/lib/types'

const VIEW_ID = 'today'

export function TodayView() {
  const { data: tasks = [], isLoading } = useTodayTasks()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const { getViewOptions } = useUIStore()
  const opts = getViewOptions(VIEW_ID)

  const today = new Date()
  const todayStr = format(today, "EEEE d 'de' MMMM", { locale: es })
  const todayDate = format(today, 'yyyy-MM-dd')

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

  const overdueTasks = visibleTasks.filter(
    (t) => t.due_date && isOverdue(t.due_date) && !t.is_completed,
  )
  const todayTasks = visibleTasks.filter(
    (t) => !t.is_completed && !(t.due_date && isOverdue(t.due_date)),
  )
  const completedTasks = visibleTasks.filter((t) => t.is_completed)

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
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Hoy
          </h1>
          <p className="mt-0.5 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
            {todayStr}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewOptionsBar viewId={VIEW_ID} availableStyles={['list', 'calendar']} hideDateFilter hideCalendarMode />
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={16} />
            Agregar tarea
          </button>
        </div>
      </div>

      {opts.viewStyle === 'calendar' ? (
        /* Day timeline calendar */
        <TodayCalendarView tasks={visibleTasks} labelsMap={labelsMap} />
      ) : opts.groupBy !== 'none' ? (
        /* Grouped view */
        <div>
          {visibleTasks.length === 0 ? (
            <div className="py-12 text-center">
              <PartyPopper size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                ¡Todo listo por hoy!
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                No tienes tareas pendientes para hoy
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <TaskGroup
                key={group.key}
                label={group.label}
                color={group.color}
                tasks={group.tasks}
                labelsMap={labelsMap}
              />
            ))
          )}
        </div>
      ) : (
        /* Default view: overdue + today + completed */
        <>
          {overdueTasks.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-red-500">
                Atrasadas ({overdueTasks.length})
              </h2>
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {overdueTasks.map((task) => (
                  <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} />
                ))}
              </div>
            </div>
          )}

          <div>
            {todayTasks.length > 0 && (
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {todayTasks.map((task) => (
                  <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} />
                ))}
              </div>
            )}
          </div>

          {opts.showCompleted && completedTasks.length > 0 && (
            <div className="mt-6">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Completadas ({completedTasks.length})
              </p>
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {completedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} />
                ))}
              </div>
            </div>
          )}

          {visibleTasks.filter((t) => !t.is_completed).length === 0 && (
            <div className="py-12 text-center">
              <PartyPopper size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
              <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                ¡Todo listo por hoy!
              </p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                No tienes tareas pendientes para hoy
              </p>
            </div>
          )}
        </>
      )}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultDate={todayDate}
      />
    </div>
  )
}
