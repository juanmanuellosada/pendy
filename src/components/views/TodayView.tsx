import { PartyPopper, CalendarDays, ListChecks } from 'lucide-react'
import { useTodayTasks, useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useTodayCalendarEvents } from '@/hooks/useCalendarEvents'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskGroup } from '@/components/tasks/TaskGroup'
import { CalendarEventItem } from '@/components/common/CalendarEventItem'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { TodayCalendarView } from './TodayCalendarView'
import { ViewOptionsBar } from './ViewOptionsBar'
import { useBulkSelection } from '@/hooks/useBulkSelection'
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
  const { data: calendarEvents = [] } = useTodayCalendarEvents()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const { getViewOptions, showConfirmDialog } = useUIStore()
  const opts = getViewOptions(VIEW_ID)
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

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
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  const selectionProps = { isSelectMode, selectedIds, onToggleSelect: toggle }

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
          {opts.viewStyle !== 'calendar' && !isSelectMode && visibleTasks.length > 0 && (
            <button
              onClick={enter}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
            >
              <ListChecks size={14} />
              Seleccionar
            </button>
          )}
          <ViewOptionsBar viewId={VIEW_ID} availableStyles={['list', 'calendar']} hideDateFilter hideCalendarMode />
        </div>
      </div>

      {opts.viewStyle === 'calendar' ? (
        <TodayCalendarView tasks={visibleTasks} labelsMap={labelsMap} calendarEvents={calendarEvents} />
      ) : opts.groupBy !== 'none' ? (
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
                isSelectMode={selectionProps.isSelectMode}
                selectedIds={selectionProps.selectedIds}
                onToggleSelect={selectionProps.onToggleSelect}
              />
            ))
          )}
        </div>
      ) : (
        <>
          {overdueTasks.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-red-500">
                Atrasadas ({overdueTasks.length})
              </h2>
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {overdueTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(task.id)}
                    onToggleSelect={() => toggle(task.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            {todayTasks.length > 0 && (
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {todayTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(task.id)}
                    onToggleSelect={() => toggle(task.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Calendar events for today */}
          {calendarEvents.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays size={14} style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Eventos de hoy
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                    {calendarEvents.length} {calendarEvents.length === 1 ? 'evento' : 'eventos'}
                  </span>
                </h2>
              </div>
              <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-secondary)' }}>
                {calendarEvents.map((event) => (
                  <CalendarEventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          )}

          {opts.showCompleted && completedTasks.length > 0 && (
            <div className="mt-6">
              <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Completadas ({completedTasks.length})
              </p>
              <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
                {completedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(task.id)}
                    onToggleSelect={() => toggle(task.id)}
                  />
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
