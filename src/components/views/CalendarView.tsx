import { useState, useRef, useMemo, useEffect, useCallback, createContext, useContext } from 'react'
import { RRule } from 'rrule'
import { createPortal } from 'react-dom'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  eachDayOfInterval,
  format,
  isToday,
  isSameMonth,
  isSameDay,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Calendar, CheckSquare, X, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCalendarTasks,
  useRecurringTasks,
  useUpdateTask,
  useCompleteTask,
} from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useAppStore } from '@/stores/appStore'
import { useCalendarEventMutations } from '@/hooks/useCalendarEvents'
import {
  useHabits,
  useHabitCompletions,
  useToggleHabitCompletion,
  useHabitSchedules,
  useSetHabitDefaultTime,
  useUpsertHabitSchedule,
  useUpdateHabit,
} from '@/hooks/useHabits'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { HabitCheckbox } from '@/components/habits/HabitCheckbox'
import { useHabitTooltip } from '@/components/habits/HabitTooltip'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { PRIORITY_COLORS } from '@/lib/constants'
import { cn, stripHtmlTags, stripLabelTokensFromText } from '@/lib/utils'
import type { Task, CalendarEvent, Habit, HabitCompletion, HabitSchedule } from '@/lib/types'
import { TaskTooltip } from '@/components/common/TaskTooltip'
import {
  CalendarEventTooltip,
  getEventColor,
  getCalendarName,
} from '@/components/common/CalendarEventTooltip'
import { CalendarEventEditor } from '@/components/common/CalendarEventEditor'
import type { CalendarMode } from '@/stores/uiStore'
import { useCalendarEventsByRange } from '@/hooks/useCalendarEvents'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  habitAppearsOnDate,
  getScheduledTimeForDate,
  timeStrToHour,
  hourToTimeStr,
  isCompletedOnDate,
} from '@/lib/habitUtils'

const GOOGLE_COLOR = '#4285F4'

/** Devuelve el ID original de una tarea virtual (quita el sufijo ::fecha) */
function originalTaskId(id: string): string {
  return id.includes('::') ? id.split('::')[0]! : id
}

/** Expande tareas recurrentes en instancias virtuales para el rango [rangeStart, rangeEnd] */
function expandRecurringTasks(tasks: Task[], rangeStart: Date, rangeEnd: Date): Task[] {
  const virtual: Task[] = []
  for (const task of tasks) {
    if (!task.is_recurring || !task.recurrence_rule || !task.due_date) continue
    try {
      const ruleStr = task.recurrence_rule.replace(/^RRULE:/i, '')
      const [y, m, d] = task.due_date.split('-').map(Number)
      const dtstart = new Date(Date.UTC(y!, m! - 1, d!))
      const rule = new RRule({ ...RRule.parseString(ruleStr), dtstart })
      const startUTC = new Date(
        Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()),
      )
      const endUTC = new Date(
        Date.UTC(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()),
      )
      for (const occ of rule.between(startUTC, endUTC, true)) {
        const occStr = [
          occ.getUTCFullYear(),
          String(occ.getUTCMonth() + 1).padStart(2, '0'),
          String(occ.getUTCDate()).padStart(2, '0'),
        ].join('-')
        if (occStr === task.due_date) continue // ya está la tarea real
        virtual.push({
          ...task,
          id: `${task.id}::${occStr}`,
          due_date: occStr,
          due_datetime:
            task.has_time && task.due_datetime
              ? (() => {
                  const orig = new Date(task.due_datetime)
                  return new Date(
                    occ.getUTCFullYear(),
                    occ.getUTCMonth(),
                    occ.getUTCDate(),
                    orig.getHours(),
                    orig.getMinutes(),
                    orig.getSeconds(),
                  ).toISOString()
                })()
              : null,
          is_completed: false,
        })
      }
    } catch {
      /* RRULE inválida */
    }
  }
  return virtual
}

const HOUR_HEIGHT = 100

/** Context que provee el HOUR_HEIGHT efectivo a los sub-componentes del calendario */
const HourHeightCtx = createContext(HOUR_HEIGHT)
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const SNAP_MINUTES = 15
const MIN_DURATION = 15

/** Calcula posiciones de columna para bloques que se superponen en el tiempo */
function computeOverlapLayout(
  items: { id: string; startH: number; endH: number }[],
): Map<string, { col: number; totalCols: number }> {
  const result = new Map<string, { col: number; totalCols: number }>()
  if (items.length === 0) return result
  const sorted = [...items].sort((a, b) => a.startH - b.startH || a.endH - b.endH)
  const colEnds: number[] = []
  const colOf: Record<string, number> = {}
  for (const item of sorted) {
    let col = colEnds.findIndex((end) => end <= item.startH)
    if (col === -1) col = colEnds.length
    colEnds[col] = item.endH
    colOf[item.id] = col
  }
  for (const item of sorted) {
    let maxCol = colOf[item.id]!
    for (const other of sorted) {
      if (other.id !== item.id && other.startH < item.endH && other.endH > item.startH) {
        maxCol = Math.max(maxCol, colOf[other.id]!)
      }
    }
    result.set(item.id, { col: colOf[item.id]!, totalCols: maxCol + 1 })
  }
  return result
}

/** CSS left/right para un bloque en su sub-columna de overlap */
function overlapPos(col: number, totalCols: number): React.CSSProperties {
  const n = Math.max(1, totalCols)
  const pct = 100 / n
  return {
    left: `calc(${(col * pct).toFixed(1)}% + 2px)`,
    right: `calc(${((n - col - 1) * pct).toFixed(1)}% + 2px)`,
  }
}

interface CalendarViewProps {
  calendarMode: CalendarMode
  onAddTask: (dateStr: string) => void
  showFutureRecurrences?: boolean
  showCompleted?: boolean
  showHabits?: boolean
}

function pxToHours(px: number, hourHeight: number = HOUR_HEIGHT): number {
  return START_HOUR + px / hourHeight
}

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function CalendarView({
  calendarMode,
  onAddTask,
  showFutureRecurrences = true,
  showCompleted = true,
  showHabits = true,
}: CalendarViewProps) {
  const isMobile = useIsMobile()
  // En mobile, semana y 4 días se colapsan a vista de día
  const effectiveMode: CalendarMode =
    isMobile && (calendarMode === 'week' || calendarMode === '4days') ? 'day' : calendarMode
  const hourHeight = isMobile ? 48 : HOUR_HEIGHT

  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const updateTask = useUpdateTask()
  const draggedTaskId = useRef<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  const { setSelectedHabit } = useAppStore()

  // Calendar event editor state (shared across all sub-components)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [creatingEventInfo, setCreatingEventInfo] = useState<{
    date: Date
    hour: number
    durationMinutes?: number
    allDay?: boolean
  } | null>(null)
  const [creatingTaskInfo, setCreatingTaskInfo] = useState<{
    date: string
    time: string
    durationMinutes: number
  } | null>(null)

  const days = useMemo((): Date[] => {
    switch (effectiveMode) {
      case 'week':
        return eachDayOfInterval({
          start: startOfWeek(currentDate, { weekStartsOn: 1 }),
          end: endOfWeek(currentDate, { weekStartsOn: 1 }),
        })
      case '4days':
        return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 3) })
      case 'day':
        return [currentDate]
      case 'month':
      default:
        return eachDayOfInterval({
          start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
        })
    }
  }, [effectiveMode, currentDate])

  const fromStr = days.length > 0 ? format(days[0]!, 'yyyy-MM-dd') : ''
  const toStr = days.length > 0 ? format(days[days.length - 1]!, 'yyyy-MM-dd') : ''
  const { data: tasks = [] } = useCalendarTasks(fromStr, toStr)
  const { data: recurringTasks = [] } = useRecurringTasks()

  const rangeFrom = days.length > 0 ? days[0]! : null
  const rangeTo = days.length > 0 ? days[days.length - 1]! : null
  const { data: calendarEvents = [] } = useCalendarEventsByRange(rangeFrom, rangeTo)

  // Habits data
  const { data: habits = [] } = useHabits()
  const { data: habitCompletions = [] } = useHabitCompletions(fromStr, toStr)
  const { data: habitSchedules = [] } = useHabitSchedules(fromStr, toStr)
  const toggleHabitCompletion = useToggleHabitCompletion()
  const setHabitDefaultTime = useSetHabitDefaultTime()
  const upsertHabitSchedule = useUpsertHabitSchedule()
  const updateHabit = useUpdateHabit()

  const eventsForDay = (date: Date): CalendarEvent[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return calendarEvents.filter((ev) => {
      const evDateStr = format(ev.start, 'yyyy-MM-dd')
      return evDateStr === dateStr
    })
  }

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((prev) => {
      switch (effectiveMode) {
        case 'week':
          return dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)
        case '4days':
          return dir === 1 ? addDays(prev, 4) : subDays(prev, 4)
        case 'day':
          return dir === 1 ? addDays(prev, 1) : subDays(prev, 1)
        case 'month':
        default:
          return dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)
      }
    })
  }

  const periodLabel = useMemo(() => {
    switch (effectiveMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy', { locale: es })
      case 'week': {
        const s = startOfWeek(currentDate, { weekStartsOn: 1 })
        const e = endOfWeek(currentDate, { weekStartsOn: 1 })
        return `${format(s, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`
      }
      case '4days': {
        const e = addDays(currentDate, 3)
        return `${format(currentDate, 'd MMM', { locale: es })} – ${format(e, 'd MMM yyyy', { locale: es })}`
      }
      case 'day':
        return format(currentDate, "EEEE d 'de' MMMM", { locale: es })
      default:
        return format(currentDate, 'MMMM yyyy', { locale: es })
    }
  }, [effectiveMode, currentDate])

  const isTimelineMode =
    effectiveMode === 'week' || effectiveMode === '4days' || effectiveMode === 'day'
  const isMonthView = effectiveMode === 'month'

  const todayViewStr = format(new Date(), 'yyyy-MM-dd')

  /* ── Drag for month grid ── */
  // Tareas expandidas con recurrencias virtuales para el rango visible
  const allTasks = useMemo(() => {
    if (!showFutureRecurrences || days.length === 0) return tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const rangeEnd = days[days.length - 1]!
    if (rangeEnd <= today) return tasks
    const rangeStart = days[0]! > today ? days[0]! : today
    // Usamos recurringTasks (todas las recurrentes sin filtro de rango) como fuente
    // para que las tareas cuyo due_date original está fuera del rango visible también se expandan
    const virtual = expandRecurringTasks(recurringTasks, rangeStart, rangeEnd)
    // Evitar duplicar tareas que ya están en tasks (mismo id original, misma fecha)
    const realKeys = new Set(tasks.map((t) => `${t.id}_${t.due_date}`))
    const filtered = virtual.filter((v) => {
      const origId = originalTaskId(v.id)
      return !realKeys.has(`${origId}_${v.due_date}`)
    })
    return [...tasks, ...filtered]
  }, [tasks, recurringTasks, days, showFutureRecurrences])

  const tasksForDay = (date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return allTasks.filter((t) => t.due_date === dateStr && (showCompleted || !t.is_completed))
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskId.current = taskId
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(dateStr)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null)
  }
  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault()
    if (draggedTaskId.current) {
      updateTask.mutate({ id: draggedTaskId.current, updates: { due_date: dateStr } })
      draggedTaskId.current = null
    }
    setDragOverDate(null)
  }

  const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const headerCols = isMonthView ? 7 : days.length

  return (
    <HourHeightCtx.Provider value={hourHeight}>
      <>
        <div className="flex flex-col animate-fade-in">
          {/* Navigation */}
          <div className="flex items-center gap-2 mb-5">
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Hoy
            </button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => navigate(1)}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                aria-label="Siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <span
              className="text-sm font-semibold capitalize"
              style={{ color: 'var(--text-primary)' }}
            >
              {periodLabel}
            </span>
          </div>

          {/* ── Timeline mode (week / 4days / day) ── */}
          {isTimelineMode && (
            <TimelineGrid
              days={days}
              tasks={allTasks}
              calendarEvents={calendarEvents}
              habits={habits}
              habitCompletions={habitCompletions}
              habitSchedules={habitSchedules}
              showFutureRecurrences={showFutureRecurrences}
              showCompleted={showCompleted}
              showHabits={showHabits}
              onNavigate={navigate}
              onEditEvent={setEditingEvent}
              onCreateEvent={setCreatingEventInfo}
              onCreateTask={setCreatingTaskInfo}
              onSetHabitDefaultTime={(habitId, time) =>
                setHabitDefaultTime.mutate({ habitId, time })
              }
              onUpsertHabitSchedule={(habitId, date, time) =>
                upsertHabitSchedule.mutate({ habitId, date, time })
              }
              onToggleHabitCompletion={(habitId, date) =>
                toggleHabitCompletion.mutate({ habitId, date })
              }
              onUpdateHabitDuration={(habitId, duration_minutes) =>
                updateHabit.mutate({ id: habitId, updates: { duration_minutes } })
              }
              onEditHabit={(habit, date) => setSelectedHabit(habit.id, format(date, 'yyyy-MM-dd'))}
            />
          )}

          {/* ── Month grid ── */}
          {isMonthView && (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div
                className="grid border-b"
                style={{
                  gridTemplateColumns: `repeat(${headerCols}, 1fr)`,
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                }}
              >
                {WEEK_DAYS.map((name) => (
                  <div
                    key={name}
                    className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {name}
                  </div>
                ))}
              </div>
              <div>
                {Array.from({ length: Math.ceil(days.length / 7) }).map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="grid"
                    style={{
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      borderBottom:
                        rowIdx < Math.ceil(days.length / 7) - 1
                          ? '1px solid var(--border-secondary)'
                          : 'none',
                    }}
                  >
                    {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      return (
                        <MonthDayCell
                          key={colIdx}
                          day={day}
                          dateStr={dateStr}
                          tasks={tasksForDay(day)}
                          calendarEvents={eventsForDay(day)}
                          habits={(() => {
                            if (!showHabits) return []
                            const dateS = format(day, 'yyyy-MM-dd')
                            if (!showFutureRecurrences && dateS > todayViewStr) return []
                            const dayH = habits.filter((h) => habitAppearsOnDate(h, day))
                            return showCompleted
                              ? dayH
                              : dayH.filter((h) => !isCompletedOnDate(habitCompletions, h.id, day))
                          })()}
                          isTodayDate={isToday(day)}
                          inCurrentMonth={isSameMonth(day, currentDate)}
                          isOver={dragOverDate === dateStr}
                          hasRightBorder={colIdx < 6}
                          onAddTask={onAddTask}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onEditEvent={setEditingEvent}
                          onEditHabit={(habit, day) =>
                            setSelectedHabit(habit.id, format(day, 'yyyy-MM-dd'))
                          }
                          onCreateEvent={(date, hour) => setCreatingEventInfo({ date, hour })}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Calendar event editor */}
        {editingEvent && (
          <CalendarEventEditor
            event={editingEvent}
            variant="panel"
            onClose={() => setEditingEvent(null)}
          />
        )}
        {creatingEventInfo && (
          <CalendarEventEditor
            defaultDate={creatingEventInfo.date}
            defaultHour={creatingEventInfo.hour}
            defaultDurationMinutes={creatingEventInfo.durationMinutes}
            defaultAllDay={creatingEventInfo.allDay}
            onClose={() => setCreatingEventInfo(null)}
          />
        )}

        {/* Task editor from calendar */}
        {creatingTaskInfo && (
          <TaskEditor
            open
            defaultDate={creatingTaskInfo.date}
            defaultTime={creatingTaskInfo.time}
            defaultDurationMinutes={creatingTaskInfo.durationMinutes}
            onClose={() => setCreatingTaskInfo(null)}
          />
        )}
      </>
    </HourHeightCtx.Provider>
  )
}

/* ═══════════════════════════════════════════════════════
   Timeline Grid (week / 4days / day)
   — Drag state lives here so it survives navigation.
   ═══════════════════════════════════════════════════════ */

interface DragState {
  taskId: string
  task: Task
  startX: number
  startY: number
  baseHour: number
  baseDuration: number
  originCol: number
}

interface CalendarEventDragState {
  event: CalendarEvent
  startX: number
  startY: number
  baseHour: number
  baseDuration: number
  originCol: number
}

function TimelineGrid({
  days,
  tasks,
  calendarEvents = [],
  habits = [],
  habitCompletions = [],
  habitSchedules = [],
  showFutureRecurrences = true,
  showCompleted = true,
  showHabits = true,
  onNavigate,
  onEditEvent,
  onCreateEvent,
  onCreateTask,
  onSetHabitDefaultTime,
  onUpsertHabitSchedule,
  onToggleHabitCompletion,
  onUpdateHabitDuration,
  onEditHabit,
}: {
  days: Date[]
  tasks: Task[]
  calendarEvents?: CalendarEvent[]
  habits?: Habit[]
  habitCompletions?: HabitCompletion[]
  habitSchedules?: HabitSchedule[]
  showFutureRecurrences?: boolean
  showCompleted?: boolean
  showHabits?: boolean
  onNavigate?: (dir: 1 | -1) => void
  onEditEvent: (event: CalendarEvent) => void
  onCreateEvent: (info: {
    date: Date
    hour: number
    durationMinutes?: number
    allDay?: boolean
  }) => void
  onCreateTask: (info: { date: string; time: string; durationMinutes: number }) => void
  onSetHabitDefaultTime?: (habitId: string, time: string) => void
  onUpsertHabitSchedule?: (habitId: string, date: string, time: string) => void
  onToggleHabitCompletion?: (habitId: string, date: Date) => void
  onUpdateHabitDuration?: (habitId: string, duration_minutes: number) => void
  onEditHabit?: (habit: Habit, date: Date) => void
}) {
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const updateTask = useUpdateTask()
  const { updateEvent: updateCalendarEvent } = useCalendarEventMutations()
  const { setSelectedTaskId } = useAppStore()

  const [now, setNow] = useState(new Date())
  const [highlightCol, setHighlightCol] = useState<number | null>(null)
  const [hoveredAllDayCol, setHoveredAllDayCol] = useState<number | null>(null)

  // Task drag state
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghostOffset, setGhostOffset] = useState({ dx: 0, dy: 0 })
  const [taskPreviewHour, setTaskPreviewHour] = useState<number | null>(null) // snapped hour para preview cross-column
  const [didMove, setDidMove] = useState(false)
  const didMoveRef = useRef(false)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [currentDragCol, setCurrentDragCol] = useState(-1)
  const [localHourHints, setLocalHourHints] = useState<Record<string, number>>({})

  // Calendar event drag state
  const [calEvDrag, setCalEvDrag] = useState<CalendarEventDragState | null>(null)
  const [calEvCurrentDy, setCalEvCurrentDy] = useState(0) // dy for same-column visual
  const [calEvPreviewHour, setCalEvPreviewHour] = useState<number | null>(null) // snapped hour for cross-column preview
  const [calEvDidMove, setCalEvDidMove] = useState(false)
  const calEvDidMoveRef = useRef(false)
  const [calEvCurrentCol, setCalEvCurrentCol] = useState(-1)
  const [calEvHighlightCol, setCalEvHighlightCol] = useState<number | null>(null)
  // Optimistic hour hints after drag (persists until server refetch)
  const [localCalEvHints, setLocalCalEvHints] = useState<Record<string, number>>({})

  // Habit drag state (from all-day chip to timeline, cross-column)
  const [habitDrag, setHabitDrag] = useState<{
    habit: Habit
    ghostHour: number | null
    ghostCol: number | null
  } | null>(null)
  const habitDragRef = useRef(habitDrag)
  useEffect(() => {
    habitDragRef.current = habitDrag
  }, [habitDrag])

  // Drag-to-create state
  const [createDrag, setCreateDrag] = useState<{
    col: number
    date: Date
    startHour: number
    currentHour: number
    startY: number
  } | null>(null)
  const [typePicker, setTypePicker] = useState<{
    date: Date
    startHour: number
    durationMinutes: number
    screenX: number
    screenY: number
  } | null>(null)

  // Drag-to-create effects
  useEffect(() => {
    if (!createDrag) return
    const onMove = (e: MouseEvent) => {
      if (!gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const rawHour = Math.max(createDrag.startHour, Math.min(START_HOUR + relY / HOUR_HEIGHT, 24))
      const snapped = Math.max(createDrag.startHour, snapMinutes(Math.round(rawHour * 60)) / 60)
      setCreateDrag((prev) => (prev ? { ...prev, currentHour: snapped } : null))
    }

    const onUp = (e: MouseEvent) => {
      if (!createDrag) return
      const dy = Math.abs(e.clientY - createDrag.startY)
      const startMin = snapMinutes(Math.round(createDrag.startHour * 60))
      const rawEndMin = Math.round(createDrag.currentHour * 60)
      const duration = dy > 8 ? Math.max(MIN_DURATION, snapMinutes(rawEndMin - startMin)) : 60
      setCreateDrag(null)
      setTypePicker({
        date: createDrag.date,
        startHour: startMin / 60,
        durationMinutes: duration,
        screenX: e.clientX,
        screenY: e.clientY,
      })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [createDrag])

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [])

  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowTop = (nowHour - START_HOUR) * HOUR_HEIGHT
  const nowLabel = format(now, 'HH:mm')
  const todayIdx = days.findIndex((d) => isSameDay(d, now))

  const dayData = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const baseTasks = tasks.filter(
        (t) => t.due_date === dateStr && (showCompleted || !t.is_completed),
      )
      const allDay = baseTasks.filter((t) => !t.has_time || !t.due_datetime)
      const timed = baseTasks.filter((t) => t.has_time && t.due_datetime)
      const dayEvents = calendarEvents.filter((ev) => format(ev.start, 'yyyy-MM-dd') === dateStr)
      const allDayEvents = dayEvents.filter((ev) => ev.isAllDay)
      const timedEvents = dayEvents.filter((ev) => !ev.isAllDay)
      let dayHabits =
        !showHabits || (!showFutureRecurrences && dateStr > todayStr)
          ? []
          : habits.filter((h) => habitAppearsOnDate(h, day))
      if (!showCompleted)
        dayHabits = dayHabits.filter((h) => !isCompletedOnDate(habitCompletions, h.id, day))
      const unscheduledHabits = dayHabits.filter(
        (h) => getScheduledTimeForDate(h, habitSchedules, day) === null,
      )
      const scheduledHabits = dayHabits.filter(
        (h) => getScheduledTimeForDate(h, habitSchedules, day) !== null,
      )

      // Layout de overlap para bloques con hora en este día
      const layoutItems: { id: string; startH: number; endH: number }[] = []
      for (const task of timed) {
        const dt = new Date(task.due_datetime!)
        const startH = dt.getHours() + dt.getMinutes() / 60
        const dur = task.duration_minutes ?? 60
        layoutItems.push({ id: task.id, startH, endH: startH + dur / 60 })
      }
      for (const ev of timedEvents) {
        const startH = ev.start.getHours() + ev.start.getMinutes() / 60
        const endH = ev.end.getHours() + ev.end.getMinutes() / 60
        layoutItems.push({ id: ev.id, startH, endH: Math.max(startH + MIN_DURATION / 60, endH) })
      }
      for (const h of scheduledHabits) {
        const time = getScheduledTimeForDate(h, habitSchedules, day)
        if (!time) continue
        const startH = timeStrToHour(time)
        layoutItems.push({ id: h.id, startH, endH: startH + h.duration_minutes / 60 })
      }
      const colLayout = computeOverlapLayout(layoutItems)

      return {
        day,
        dateStr,
        allDay,
        timed,
        allDayEvents,
        timedEvents,
        unscheduledHabits,
        scheduledHabits,
        colLayout,
      }
    })
  }, [
    days,
    tasks,
    calendarEvents,
    habits,
    habitCompletions,
    habitSchedules,
    showFutureRecurrences,
    showCompleted,
    showHabits,
  ])

  // hasAnyAllDay removed — all-day row is always visible

  const getColFromX = useCallback(
    (clientX: number): number => {
      if (!gridRef.current) return -1
      const rect = gridRef.current.getBoundingClientRect()
      const hourLabelWidth = 56
      const colAreaLeft = rect.left + hourLabelWidth
      const colAreaWidth = rect.width - hourLabelWidth
      const colWidth = colAreaWidth / days.length
      return Math.floor((clientX - colAreaLeft) / colWidth)
    },
    [days.length],
  )

  const getHourFromY = useCallback(
    (clientY: number): number => {
      if (!gridRef.current) return 0
      const rect = gridRef.current.getBoundingClientRect()
      // rect.top ya incluye el efecto del scroll del contenedor (la grid sube en el viewport
      // cuando se scrollea), por lo que NO se suma scrollTop nuevamente.
      const py = clientY - rect.top
      return pxToHours(py, HOUR_HEIGHT)
    },
    [HOUR_HEIGHT],
  )

  /* ── Start task drag (called by task blocks) ── */
  const handleTaskDragStart = useCallback(
    (task: Task, e: React.MouseEvent) => {
      if (task.id.includes('::')) return // tarea virtual — no arrastrar
      const dt = new Date(task.due_datetime!)
      const hour = dt.getHours() + dt.getMinutes() / 60
      const col = getColFromX(e.clientX)
      setDidMove(false)
      didMoveRef.current = false

      setTaskPreviewHour(null)
      setDrag({
        taskId: task.id,
        task,
        startX: e.clientX,
        startY: e.clientY,
        baseHour: hour,
        baseDuration: task.duration_minutes || 60,
        originCol: col,
      })
      setGhostOffset({ dx: 0, dy: 0 })
    },
    [getColFromX],
  )

  /* ── Start calendar event drag ── */
  const handleCalEvDragStart = useCallback(
    (event: CalendarEvent, e: React.MouseEvent) => {
      if (!event.calendarId) return // can't update without calendarId
      const hour = event.start.getHours() + event.start.getMinutes() / 60
      const duration = Math.max(
        (event.end.getTime() - event.start.getTime()) / 60_000,
        MIN_DURATION,
      )
      const col = getColFromX(e.clientX)
      setCalEvDidMove(false)
      calEvDidMoveRef.current = false
      setCalEvCurrentDy(0)
      setCalEvPreviewHour(null)

      setCalEvDrag({
        event,
        startX: e.clientX,
        startY: e.clientY,
        baseHour: hour,
        baseDuration: duration,
        originCol: col,
      })
    },
    [getColFromX],
  )

  /* ── Task drag move & drop ── */
  useEffect(() => {
    if (!drag) return

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - drag.startX
      const dy = ev.clientY - drag.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMoveRef.current = true
        setDidMove(true)
      }
      setGhostOffset({ dx, dy })

      const col = getColFromX(ev.clientX)
      setCurrentDragCol(col)
      if (col >= 0 && col < days.length) {
        if (col !== drag.originCol) {
          setHighlightCol(col)
          const rawHour = getHourFromY(ev.clientY)
          const totalMin = snapMinutes(Math.round(rawHour * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - drag.baseDuration))
          setTaskPreviewHour(clampedMin / 60)
        } else {
          setHighlightCol(null)
          setTaskPreviewHour(null)
        }
        if (edgeTimer.current) {
          clearTimeout(edgeTimer.current)
          edgeTimer.current = null
        }
      } else {
        setHighlightCol(null)
        setTaskPreviewHour(null)
        if (!edgeTimer.current && onNavigate) {
          const dir = col < 0 ? -1 : 1
          edgeTimer.current = setTimeout(() => {
            const edgeDay = dir === -1 ? addDays(days[0]!, -1) : addDays(days[days.length - 1]!, 1)
            const hour = getHourFromY(ev.clientY)
            const totalMin = snapMinutes(Math.round(hour * 60))
            const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - drag.baseDuration))
            const h = Math.floor(clampedMin / 60)
            const m = clampedMin % 60
            const newDt = new Date(edgeDay)
            newDt.setHours(h, m, 0, 0)

            updateTask.mutate({
              id: drag.taskId,
              updates: {
                due_date: format(edgeDay, 'yyyy-MM-dd'),
                due_datetime: newDt.toISOString(),
              },
            })
            setDrag((prev) =>
              prev
                ? {
                    ...prev,
                    originCol: -999,
                    task: { ...prev.task, due_date: format(edgeDay, 'yyyy-MM-dd') },
                    baseHour: h + m / 60,
                  }
                : null,
            )
            onNavigate(dir as 1 | -1)
            edgeTimer.current = null
          }, 350)
        }
      }
    }

    const onUp = (ev: MouseEvent) => {
      if (edgeTimer.current) {
        clearTimeout(edgeTimer.current)
        edgeTimer.current = null
      }
      setHighlightCol(null)
      setCurrentDragCol(-1)
      setTaskPreviewHour(null)

      const col = getColFromX(ev.clientX)
      const moved = didMoveRef.current

      if (moved) {
        const clampedCol = Math.max(0, Math.min(col, days.length - 1))
        const targetDay = days[clampedCol]
        if (targetDay) {
          const isSameCol = clampedCol === drag.originCol
          const rawHour = isSameCol
            ? pxToHours(
                (drag.baseHour - START_HOUR) * HOUR_HEIGHT + (ev.clientY - drag.startY),
                HOUR_HEIGHT,
              )
            : getHourFromY(ev.clientY)
          const totalMin = snapMinutes(Math.round(rawHour * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - drag.baseDuration))
          const h = Math.floor(clampedMin / 60)
          const m = clampedMin % 60
          const newDt = new Date(targetDay)
          newDt.setHours(h, m, 0, 0)

          const sameDayAndTime =
            format(targetDay, 'yyyy-MM-dd') === drag.task.due_date &&
            Math.abs(h + m / 60 - drag.baseHour) < 0.01

          if (!sameDayAndTime) {
            if (isSameCol) {
              setLocalHourHints((prev) => ({ ...prev, [drag.taskId]: h + m / 60 }))
            }
            updateTask.mutate({
              id: drag.taskId,
              updates: {
                due_date: format(targetDay, 'yyyy-MM-dd'),
                due_datetime: newDt.toISOString(),
              },
            })
          }
        }
      } else {
        setSelectedTaskId(originalTaskId(drag.taskId))
      }

      setDrag(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [drag, days, getColFromX, getHourFromY, onNavigate, updateTask, setSelectedTaskId])

  /* ── Calendar event drag move & drop ── */
  useEffect(() => {
    if (!calEvDrag) return

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - calEvDrag.startX
      const dy = ev.clientY - calEvDrag.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        calEvDidMoveRef.current = true
        setCalEvDidMove(true)
      }
      setCalEvCurrentDy(dy)

      const col = getColFromX(ev.clientX)
      setCalEvCurrentCol(col)
      if (col >= 0 && col < days.length) {
        if (col !== calEvDrag.originCol) {
          setCalEvHighlightCol(col)
          // Calcular hora con snap para el preview en la columna destino
          const rawHour = getHourFromY(ev.clientY)
          const totalMin = snapMinutes(Math.round(rawHour * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - calEvDrag.baseDuration))
          setCalEvPreviewHour(clampedMin / 60)
        } else {
          setCalEvHighlightCol(null)
          setCalEvPreviewHour(null)
        }
      } else {
        setCalEvHighlightCol(null)
        setCalEvPreviewHour(null)
      }
    }

    const onUp = async (ev: MouseEvent) => {
      setCalEvHighlightCol(null)
      setCalEvCurrentCol(-1)
      setCalEvPreviewHour(null)
      setCalEvCurrentDy(0)

      const col = getColFromX(ev.clientX)
      const moved = calEvDidMoveRef.current
      const frozenDrag = calEvDrag

      setCalEvDrag(null)

      if (moved && frozenDrag.event.calendarId) {
        const clampedCol = Math.max(0, Math.min(col, days.length - 1))
        const targetDay = days[clampedCol]
        if (targetDay) {
          const isSameCol = clampedCol === frozenDrag.originCol
          const rawHour = isSameCol
            ? pxToHours(
                (frozenDrag.baseHour - START_HOUR) * HOUR_HEIGHT + (ev.clientY - frozenDrag.startY),
                HOUR_HEIGHT,
              )
            : getHourFromY(ev.clientY)
          const totalMin = snapMinutes(Math.round(rawHour * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - frozenDrag.baseDuration))
          const h = Math.floor(clampedMin / 60)
          const m = clampedMin % 60
          const newStart = new Date(targetDay)
          newStart.setHours(h, m, 0, 0)
          const newEnd = new Date(newStart.getTime() + frozenDrag.baseDuration * 60_000)

          const eventId = frozenDrag.event.id
          setLocalCalEvHints((prev) => ({ ...prev, [eventId]: h + m / 60 }))
          try {
            await updateCalendarEvent.mutateAsync({
              eventId,
              calendarId: frozenDrag.event.calendarId!,
              start: newStart,
              end: newEnd,
            })
          } catch (err) {
            setLocalCalEvHints((prev) => {
              const next = { ...prev }
              delete next[eventId]
              return next
            })
            const msg =
              err instanceof Error && err.message === 'PERMISSION_DENIED'
                ? 'Sin permiso para editar este evento. Reconecta Google Calendar con permisos de escritura.'
                : 'No se pudo mover el evento. Intenta de nuevo.'
            toast.error(msg)
          }
        }
      } else if (!moved) {
        // No movement → open editor
        onEditEvent(frozenDrag.event)
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [calEvDrag, days, getColFromX, getHourFromY, updateCalendarEvent, onEditEvent])

  // Cleanup edge timer on unmount
  useEffect(
    () => () => {
      if (edgeTimer.current) clearTimeout(edgeTimer.current)
    },
    [],
  )

  /* ── Habit drag from all-day chip to timeline (multi-column) ── */
  const startHabitDragInGrid = useCallback(
    (habit: Habit, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHabitDrag({ habit, ghostHour: null, ghostCol: null })

      const onMove = (ev: MouseEvent) => {
        if (!gridRef.current) return
        const rect = gridRef.current.getBoundingClientRect()
        const y = ev.clientY - rect.top
        if (y < 0) {
          setHabitDrag((p) => (p ? { ...p, ghostHour: null, ghostCol: null } : null))
          return
        }
        const rawHour = pxToHours(y, HOUR_HEIGHT)
        const snappedMin = snapMinutes(Math.round(rawHour * 60))
        const snapped = Math.max(START_HOUR, snappedMin / 60)
        const col = getColFromX(ev.clientX)
        setHabitDrag((p) =>
          p
            ? { ...p, ghostHour: snapped, ghostCol: col >= 0 && col < days.length ? col : null }
            : null,
        )
      }

      const onUp = (_ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        const state = habitDragRef.current
        setHabitDrag(null)
        if (!state?.ghostHour || state.ghostCol === null) return

        const targetDay = days[state.ghostCol]
        if (!targetDay) return

        const time = hourToTimeStr(state.ghostHour)
        const dateStr = format(targetDay, 'yyyy-MM-dd')

        if (!state.habit.scheduled_time) {
          onSetHabitDefaultTime?.(state.habit.id, time)
        } else {
          onUpsertHabitSchedule?.(state.habit.id, dateStr, time)
        }
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [HOUR_HEIGHT, days, getColFromX, onSetHabitDefaultTime, onUpsertHabitSchedule],
  )

  const isDragSameCol = !!(
    drag &&
    didMove &&
    currentDragCol >= 0 &&
    currentDragCol === drag.originCol
  )
  const isCalEvSameCol = !!(
    calEvDrag &&
    calEvDidMove &&
    calEvCurrentCol >= 0 &&
    calEvCurrentCol === calEvDrag.originCol
  )

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      {/* Day headers */}
      <div
        className="grid border-b"
        style={{
          gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
          borderColor: 'var(--border-primary)',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        <div />
        {days.map((day, i) => (
          <div
            key={i}
            className="py-2 text-center"
            style={{ borderLeft: '1px solid var(--border-secondary)' }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {format(day, 'EEE', { locale: es })}
            </p>
            <div
              className="mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              style={{
                backgroundColor: isToday(day) ? 'var(--color-primary)' : 'transparent',
                color: isToday(day) ? '#fff' : 'var(--text-primary)',
              }}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row — siempre visible para poder crear eventos/tareas todo el día */}
      <div
        className="grid border-b"
        style={{
          gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
          borderColor: 'var(--border-secondary)',
        }}
      >
        <div
          className="flex items-start justify-end pr-2 pt-1 text-[10px]"
          style={{ color: 'var(--text-muted)' }}
        >
          Todo el día
        </div>
        {dayData.map((dd, i) => {
          const dateStr = format(dd.day, 'yyyy-MM-dd')
          const isHovered = hoveredAllDayCol === i
          return (
            <div
              key={i}
              className="relative min-h-[28px] border-l p-1 flex flex-col gap-0.5 overflow-hidden min-w-0"
              style={{ borderColor: 'var(--border-secondary)' }}
              onMouseEnter={() => setHoveredAllDayCol(i)}
              onMouseLeave={() => setHoveredAllDayCol(null)}
            >
              {dd.allDay.map((t) => (
                <TaskTooltip key={t.id} task={t}>
                  <AllDayChip task={t} />
                </TaskTooltip>
              ))}
              {dd.allDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs overflow-hidden min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: (ev.calendarColor ?? GOOGLE_COLOR) + '20' }}
                  title={ev.title}
                  onClick={() => onEditEvent(ev)}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.calendarColor ?? GOOGLE_COLOR }}
                  />
                  <span
                    className="truncate min-w-0 flex-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {ev.title}
                  </span>
                </div>
              ))}
              {dd.unscheduledHabits.map((habit) => (
                <CalendarHabitChip
                  key={habit.id}
                  habit={habit}
                  completions={habitCompletions}
                  date={dd.day}
                  onToggle={() => onToggleHabitCompletion?.(habit.id, dd.day)}
                  onDragStart={(e) => startHabitDragInGrid(habit, e)}
                  onEdit={() => onEditHabit?.(habit, dd.day)}
                />
              ))}
              {/* Hover buttons to create */}
              {isHovered && (
                <div className="absolute right-1 top-1 flex items-center gap-0.5 z-10">
                  <button
                    onClick={() => onCreateEvent({ date: dd.day, hour: 9, allDay: true })}
                    className="rounded p-0.5 transition-opacity hover:opacity-70"
                    style={{ color: '#4285F4', backgroundColor: 'var(--bg-primary)' }}
                    title="Nuevo evento de calendario todo el día"
                  >
                    <Plus size={10} />
                  </button>
                  <button
                    onClick={() => onCreateTask({ date: dateStr, time: '', durationMinutes: 0 })}
                    className="rounded p-0.5 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)' }}
                    title="Nueva tarea todo el día"
                  >
                    <CheckSquare size={10} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Timeline body */}
      <div
        ref={containerRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        <div
          ref={gridRef}
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          {/* Hour labels */}
          <div>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="relative pr-2 text-right text-[11px]"
                style={{ height: HOUR_HEIGHT, color: 'var(--text-muted)' }}
              >
                <span className="relative -top-2">{`${(START_HOUR + i).toString().padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayData.map((dd, colIdx) => (
            <div
              key={colIdx}
              className="relative border-l transition-colors duration-150 cursor-crosshair"
              style={{
                borderColor: 'var(--border-secondary)',
                backgroundColor:
                  highlightCol === colIdx || calEvHighlightCol === colIdx
                    ? 'var(--bg-hover)'
                    : 'transparent',
              }}
            >
              {/* Backdrop for drag-to-create (sits behind task/event blocks at z-0) */}
              <div
                className="absolute inset-0 z-0 cursor-crosshair"
                onMouseDown={(e) => {
                  if (!gridRef.current) return
                  e.preventDefault()
                  const hour = Math.max(0, Math.min(getHourFromY(e.clientY), 23.75))
                  setCreateDrag({
                    col: colIdx,
                    date: dd.day,
                    startHour: hour,
                    currentHour: hour,
                    startY: e.clientY,
                  })
                }}
              />

              {/* Creation ghost preview during drag for this column */}
              {createDrag && createDrag.col === colIdx && (
                <div
                  className="pointer-events-none absolute left-0.5 right-0.5 z-20 rounded-md"
                  style={{
                    top: (createDrag.startHour - START_HOUR) * HOUR_HEIGHT,
                    height:
                      Math.max(MIN_DURATION / 60, createDrag.currentHour - createDrag.startHour) *
                      HOUR_HEIGHT,
                    backgroundColor: 'color-mix(in srgb, var(--color-primary) 25%, transparent)',
                    border: '2px dashed var(--color-primary)',
                  }}
                />
              )}

              {/* Hour lines (pointer-events-none — purely visual) */}
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div
                  key={i}
                  className="pointer-events-none border-t"
                  style={{ height: HOUR_HEIGHT, borderColor: 'var(--border-secondary)' }}
                />
              ))}

              {dd.timed.map((task) => {
                const layout = dd.colLayout.get(task.id)
                return (
                  <TaskTooltip key={task.id} task={task} disabled={!!drag}>
                    <TimelineTaskBlock
                      task={task}
                      isDragging={!!(drag?.taskId === task.id && didMove && !isDragSameCol)}
                      activeDragDy={drag?.taskId === task.id && isDragSameCol ? ghostOffset.dy : 0}
                      localHourHint={localHourHints[task.id]}
                      onDragStart={handleTaskDragStart}
                      col={layout?.col}
                      totalCols={layout?.totalCols}
                    />
                  </TaskTooltip>
                )
              })}
              {dd.timedEvents.map((ev) => {
                const layout = dd.colLayout.get(ev.id)
                return (
                  <CalendarTimelineBlock
                    key={ev.id}
                    event={ev}
                    isDragging={
                      !!(calEvDrag?.event.id === ev.id && calEvDidMove && !isCalEvSameCol)
                    }
                    activeDragDy={
                      calEvDrag?.event.id === ev.id && isCalEvSameCol ? calEvCurrentDy : 0
                    }
                    localHourHint={localCalEvHints[ev.id]}
                    onDragStart={handleCalEvDragStart}
                    col={layout?.col}
                    totalCols={layout?.totalCols}
                  />
                )
              })}
              {dd.scheduledHabits.map((habit) => {
                const scheduledTime = getScheduledTimeForDate(habit, habitSchedules, dd.day)!
                const layout = dd.colLayout.get(habit.id)
                return (
                  <CalendarHabitBlock
                    key={habit.id}
                    habit={habit}
                    scheduledTime={scheduledTime}
                    date={dd.day}
                    completions={habitCompletions}
                    onReschedule={(time) => onUpsertHabitSchedule?.(habit.id, dd.dateStr, time)}
                    onToggle={() => onToggleHabitCompletion?.(habit.id, dd.day)}
                    onUpdateDuration={(mins) => onUpdateHabitDuration?.(habit.id, mins)}
                    onEdit={() => onEditHabit?.(habit, dd.day)}
                    col={layout?.col}
                    totalCols={layout?.totalCols}
                  />
                )
              })}
              {/* Habit drag ghost preview in this column */}
              {habitDrag?.ghostHour !== null &&
                habitDrag?.ghostHour !== undefined &&
                habitDrag.ghostCol === colIdx && (
                  <div
                    className="pointer-events-none absolute left-0.5 right-0.5 z-20 rounded-md border-l-2"
                    style={{
                      top: (habitDrag.ghostHour - START_HOUR) * HOUR_HEIGHT,
                      height: (habitDrag.habit.duration_minutes / 60) * HOUR_HEIGHT,
                      backgroundColor: `${habitDrag.habit.color}25`,
                      borderLeftColor: habitDrag.habit.color,
                    }}
                  >
                    <p
                      className="truncate px-1.5 py-0.5 text-[11px] font-medium"
                      style={{ color: habitDrag.habit.color }}
                    >
                      {habitDrag.habit.icon && `${habitDrag.habit.icon} `}
                      {stripHtmlTags(habitDrag.habit.name)}
                    </p>
                  </div>
                )}

              {/* Preview de tarea al arrastrar a otro día */}
              {drag &&
                didMove &&
                highlightCol === colIdx &&
                taskPreviewHour != null &&
                (() => {
                  const taskColor = PRIORITY_COLORS[drag.task.priority] ?? PRIORITY_COLORS[4]
                  return (
                    <div
                      className="pointer-events-none absolute left-0.5 right-0.5 z-20 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 shadow-md"
                      style={{
                        top: (taskPreviewHour - START_HOUR) * HOUR_HEIGHT,
                        height: Math.max(
                          (drag.baseDuration / 60) * HOUR_HEIGHT,
                          (MIN_DURATION / 60) * HOUR_HEIGHT,
                        ),
                        borderLeftColor: taskColor,
                        backgroundColor: `${taskColor}40`,
                        outline: `1.5px dashed ${taskColor}`,
                        outlineOffset: '-1px',
                      }}
                    >
                      <p
                        className="truncate text-[11px] font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {stripHtmlTags(drag.task.title)}
                      </p>
                    </div>
                  )
                })()}

              {/* Preview de evento al arrastrar a otro día */}
              {calEvDrag &&
                calEvDidMove &&
                calEvHighlightCol === colIdx &&
                calEvPreviewHour != null && (
                  <div
                    className="pointer-events-none absolute left-0.5 right-0.5 z-20 overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 shadow-md"
                    style={{
                      top: (calEvPreviewHour - START_HOUR) * HOUR_HEIGHT,
                      height: Math.max(
                        (calEvDrag.baseDuration / 60) * HOUR_HEIGHT,
                        (MIN_DURATION / 60) * HOUR_HEIGHT,
                      ),
                      borderLeftColor: getEventColor(calEvDrag.event),
                      backgroundColor: `${getEventColor(calEvDrag.event)}40`,
                      outline: `1.5px dashed ${getEventColor(calEvDrag.event)}`,
                      outlineOffset: '-1px',
                    }}
                  >
                    <p
                      className="truncate text-[11px] font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {calEvDrag.event.title}
                    </p>
                  </div>
                )}

              {colIdx === todayIdx && (
                <div
                  ref={nowLineRef}
                  className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                  style={{ top: nowTop }}
                >
                  <div
                    className="h-2.5 w-2.5 -ml-[5px] rounded-full"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  />
                  <div
                    className="flex-1 border-t-2"
                    style={{ borderColor: 'var(--color-accent)' }}
                  />
                </div>
              )}
            </div>
          ))}

          {todayIdx >= 0 && (
            <div
              className="pointer-events-none absolute left-0 z-20"
              style={{ top: nowTop - 7, width: 56 }}
            >
              <span
                className="block text-right pr-2 text-[10px] font-semibold"
                style={{ color: 'var(--color-accent)' }}
              >
                {nowLabel}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Type picker popup after drag */}
      {typePicker &&
        createPortal(
          <CalendarCreationTypePicker
            date={typePicker.date}
            startHour={typePicker.startHour}
            durationMinutes={typePicker.durationMinutes}
            screenX={typePicker.screenX}
            screenY={typePicker.screenY}
            onEvent={() => {
              onCreateEvent({
                date: typePicker.date,
                hour: typePicker.startHour,
                durationMinutes: typePicker.durationMinutes,
              })
              setTypePicker(null)
            }}
            onTask={() => {
              const h = Math.floor(typePicker.startHour)
              const m = Math.round((typePicker.startHour - h) * 60)
              const dateStr = format(typePicker.date, 'yyyy-MM-dd')
              onCreateTask({
                date: dateStr,
                time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                durationMinutes: typePicker.durationMinutes,
              })
              setTypePicker(null)
            }}
            onClose={() => setTypePicker(null)}
          />,
          document.body,
        )}
    </div>
  )
}

/* ── Creation type picker popup ─────────────────────────────── */

function fmtHr(fractionalHour: number): string {
  const h = Math.floor(fractionalHour) % 24
  const m = Math.round((fractionalHour - Math.floor(fractionalHour)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function CalendarCreationTypePicker({
  startHour,
  durationMinutes,
  screenX,
  screenY,
  onEvent,
  onTask,
  onClose,
}: {
  date: Date
  startHour: number
  durationMinutes: number
  screenX: number
  screenY: number
  onEvent: () => void
  onTask: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle, true)
    return () => document.removeEventListener('mousedown', handle, true)
  }, [onClose])

  const endHour = startHour + durationMinutes / 60
  const timeLabel = `${fmtHr(startHour)} – ${fmtHr(endHour)}`

  const W = 176
  const H = 118
  const left = Math.min(Math.max(screenX + 8, 8), window.innerWidth - W - 8)
  const top = Math.min(Math.max(screenY + 8, 8), window.innerHeight - H - 8)

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 9999,
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        padding: '8px',
        width: W,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{timeLabel}</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 4,
            lineHeight: 1,
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <X size={12} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          onClick={onEvent}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 500,
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Calendar size={14} style={{ color: 'var(--color-link)' }} />
          Nuevo evento
        </button>
        <button
          onClick={onTask}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 500,
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <CheckSquare size={14} style={{ color: '#22C55E' }} />
          Nueva tarea
        </button>
      </div>
    </div>
  )
}

/* ── Calendar event timeline block (draggable + resizable) ─── */

function CalendarTimelineBlock({
  event,
  isDragging,
  activeDragDy = 0,
  localHourHint,
  onDragStart,
  col = 0,
  totalCols = 1,
}: {
  event: CalendarEvent
  isDragging: boolean
  activeDragDy?: number
  localHourHint?: number
  onDragStart: (event: CalendarEvent, e: React.MouseEvent) => void
  col?: number
  totalCols?: number
}) {
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const { updateEvent } = useCalendarEventMutations()
  const color = getEventColor(event)
  const calendarName = getCalendarName(event)

  const serverStartHour = event.start.getHours() + event.start.getMinutes() / 60
  const serverDuration = Math.max(
    (event.end.getTime() - event.start.getTime()) / 60_000,
    MIN_DURATION,
  )

  // Optimistic state: persists until server data matches
  const [localDuration, setLocalDuration] = useState<number | null>(null)

  useEffect(() => {
    if (localDuration != null && Math.abs(serverDuration - localDuration) < 1) {
      setLocalDuration(null)
    }
  }, [serverDuration, localDuration])

  // Use local hints when server hasn't updated yet
  const effectiveHour =
    localHourHint != null && Math.abs(serverStartHour - localHourHint) > 0.01
      ? localHourHint
      : serverStartHour
  const effectiveDuration = localDuration ?? serverDuration

  const baseTop = (effectiveHour - START_HOUR) * HOUR_HEIGHT + activeDragDy
  const [resizeDelta, setResizeDelta] = useState(0)
  const [resizing, setResizing] = useState(false)

  const currentHeight = Math.max(
    (effectiveDuration / 60) * HOUR_HEIGHT + resizeDelta,
    (MIN_DURATION / 60) * HOUR_HEIGHT,
  )
  const renderHeight = currentHeight

  const displayHours = pxToHours(Math.max(0, baseTop), HOUR_HEIGHT)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const durMin = Math.max(MIN_DURATION, Math.round((currentHeight / HOUR_HEIGHT) * 60))
  const eHours = displayHours + durMin / 60
  const startLabel = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const endLabel = `${String(Math.floor(eHours) % 24).padStart(2, '0')}:${String(Math.round((eHours % 1) * 60) % 60).padStart(2, '0')}`

  const showTime = renderHeight >= 38
  const showCalendarName = renderHeight >= 54
  const isSameColDrag = activeDragDy !== 0

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setResizing(true)
      const startY = e.clientY
      let latestDelta = 0

      const onMove = (ev: MouseEvent) => {
        latestDelta = ev.clientY - startY
        setResizeDelta(latestDelta)
      }
      const onUp = async () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setResizing(false)
        setResizeDelta(0)

        if (Math.abs(latestDelta) >= 4) {
          const newPx = Math.max(
            (MIN_DURATION / 60) * HOUR_HEIGHT,
            (effectiveDuration / 60) * HOUR_HEIGHT + latestDelta,
          )
          const snapped = Math.max(
            MIN_DURATION,
            snapMinutes(Math.round((newPx / HOUR_HEIGHT) * 60)),
          )

          if (event.calendarId) {
            const newEnd = new Date(event.start.getTime() + snapped * 60_000)
            setLocalDuration(snapped)
            try {
              await updateEvent.mutateAsync({
                eventId: event.id,
                calendarId: event.calendarId,
                start: event.start,
                end: newEnd,
              })
            } catch (err) {
              setLocalDuration(null)
              const msg =
                err instanceof Error && err.message === 'PERMISSION_DENIED'
                  ? 'Sin permiso para editar este evento. Reconecta Google Calendar con permisos de escritura.'
                  : 'No se pudo cambiar la duración del evento. Intenta de nuevo.'
              toast.error(msg)
            }
          }
        }
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [effectiveDuration, event, updateEvent, HOUR_HEIGHT],
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    e.preventDefault()
    e.stopPropagation()
    onDragStart(event, e)
  }

  return (
    <CalendarEventTooltip event={event} disabled={isDragging || resizing || isSameColDrag}>
      <div
        className={cn(
          'group absolute left-0.5 right-0.5 z-10 select-none overflow-hidden rounded-md border-l-2 px-1.5 py-0.5',
          isDragging && 'opacity-25',
          isSameColDrag
            ? 'shadow-lg z-30 cursor-grabbing'
            : resizing
              ? 'shadow-lg z-30'
              : 'cursor-pointer opacity-90 hover:opacity-100',
        )}
        style={{
          top: Math.max(0, baseTop),
          height: renderHeight,
          borderLeftColor: color,
          backgroundColor: `${color}1A`,
          transition:
            isSameColDrag || isDragging || resizing ? 'none' : 'top 0.15s ease, height 0.15s ease',
          ...overlapPos(col, totalCols),
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1">
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <p
            className="truncate text-[11px] font-medium leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {event.title}
          </p>
        </div>
        {showTime && (
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {startLabel}–{endLabel}
          </p>
        )}
        {showCalendarName && (
          <p className="truncate text-[10px]" style={{ color: `${color}BB` }}>
            {calendarName}
          </p>
        )}

        {/* Resize handle */}
        <div
          data-resize-handle
          className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ height: 7 }}
          onMouseDown={handleResizeStart}
        >
          <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </div>
    </CalendarEventTooltip>
  )
}

/* ── Timeline task block (stationary, with resize) ───── */

function TimelineTaskBlock({
  task,
  isDragging,
  activeDragDy = 0,
  localHourHint,
  onDragStart,
  onMouseEnter,
  onMouseLeave,
  col = 0,
  totalCols = 1,
}: {
  task: Task
  isDragging: boolean
  activeDragDy?: number
  localHourHint?: number
  onDragStart: (task: Task, e: React.MouseEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  col?: number
  totalCols?: number
}) {
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const updateTask = useUpdateTask()
  const completeTask = useCompleteTask()
  const { data: projects } = useProjects()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]
  const isVirtual = task.id.includes('::')

  const dt = new Date(task.due_datetime!)
  const serverHour = dt.getHours() + dt.getMinutes() / 60
  const duration = task.duration_minutes || 60

  const effectiveHour =
    localHourHint != null && Math.abs(serverHour - localHourHint) > 0.01
      ? localHourHint
      : serverHour

  const baseTop = (effectiveHour - START_HOUR) * HOUR_HEIGHT
  const currentTop = baseTop + activeDragDy
  const baseHeight = (duration / 60) * HOUR_HEIGHT

  const [resizeDelta, setResizeDelta] = useState(0)
  const [resizing, setResizing] = useState(false)
  const currentHeight = Math.max(baseHeight + resizeDelta, (MIN_DURATION / 60) * HOUR_HEIGHT)

  const displayHours = pxToHours(Math.max(0, currentTop), HOUR_HEIGHT)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const durationMin = Math.max(MIN_DURATION, Math.round((currentHeight / HOUR_HEIGHT) * 60))
  const eHours = displayHours + durationMin / 60
  const timeStart = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const timeEnd = `${String(Math.min(Math.floor(eHours), 23)).padStart(2, '0')}:${String(Math.round((eHours % 1) * 60) % 60).padStart(2, '0')}`
  const timeStr = `${timeStart}–${timeEnd}`

  const project = projects?.find((p) => p.id === task.project_id)
  const labels = labelsMap?.get(task.id) ?? []
  const description = task.description ? stripHtmlTags(task.description).trim() : ''

  const isCompact = currentHeight < 30
  const showTimeSeparate = !isCompact && currentHeight >= 38
  const showDescription = currentHeight >= 60 && description
  const showProject = currentHeight >= 78 && project
  const showLabels = currentHeight >= 96 && labels.length > 0

  const isSameColDrag = activeDragDy !== 0

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (isVirtual) return
      e.preventDefault()
      e.stopPropagation()
      setResizing(true)
      const startY = e.clientY

      const onMove = (ev: MouseEvent) => setResizeDelta(ev.clientY - startY)
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setResizing(false)
        setResizeDelta((prev) => {
          if (Math.abs(prev) < 4) return 0
          const newPx = Math.max((MIN_DURATION / 60) * HOUR_HEIGHT, baseHeight + prev)
          const snapped = Math.max(
            MIN_DURATION,
            snapMinutes(Math.round((newPx / HOUR_HEIGHT) * 60)),
          )
          updateTask.mutate({ id: task.id, updates: { duration_minutes: snapped } })
          return 0
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [isVirtual, baseHeight, task.id, updateTask],
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    onDragStart(task, e)
  }

  return (
    <div
      className={cn(
        'group absolute left-0.5 right-0.5 z-10 select-none overflow-hidden rounded-md border-l-3',
        isCompact ? 'px-1.5 py-0' : 'px-1.5 py-0.5',
        task.is_completed && 'opacity-50',
        isDragging && 'opacity-30',
        isVirtual && 'opacity-60',
        isSameColDrag ? 'shadow-lg z-30' : resizing ? 'shadow-lg z-30' : 'cursor-pointer',
      )}
      style={{
        top: currentTop,
        height: currentHeight,
        borderLeftColor: color,
        backgroundColor: `${color}18`,
        ...(isVirtual ? { outline: `1px dashed ${color}80`, outlineOffset: '-1px' } : {}),
        transition:
          isSameColDrag || isDragging || resizing ? 'none' : 'top 0.15s ease, height 0.15s ease',
        ...overlapPos(col, totalCols),
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isCompact ? (
        /* ── Compact mode: single row, no checkbox ── */
        <div className="flex items-center gap-1 h-full">
          <button
            className="shrink-0 w-3 h-3 rounded-full border-2 flex items-center justify-center transition-colors hover:opacity-80"
            style={{
              borderColor: color,
              backgroundColor: task.is_completed ? color : color + '30',
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!isVirtual) completeTask.mutate({ id: task.id, completed: !task.is_completed })
            }}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <p
            className={cn(
              'truncate text-[10px] font-medium flex-1 min-w-0 leading-none',
              task.is_completed && 'line-through opacity-50',
            )}
            style={{ color: 'var(--text-primary)' }}
          >
            {stripLabelTokensFromText(stripHtmlTags(task.title))}
          </p>
          <span
            className="shrink-0 text-[10px] whitespace-nowrap"
            style={{ color: 'var(--text-muted)' }}
          >
            {timeStart}
            {task.is_recurring && <span className="ml-0.5">↻</span>}
          </span>
        </div>
      ) : (
        /* ── Normal mode ── */
        <div className="flex items-start gap-1">
          <div className="mt-0.5">
            <TaskCheckbox
              checked={task.is_completed}
              priority={task.priority}
              onChange={
                isVirtual
                  ? () => {}
                  : (completed) => completeTask.mutate({ id: task.id, completed })
              }
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  'truncate text-[11px] font-medium flex-1 min-w-0',
                  task.is_completed && 'line-through',
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                {stripLabelTokensFromText(stripHtmlTags(task.title))}
              </p>
              {!showTimeSeparate && (
                <span
                  className="shrink-0 text-[10px] whitespace-nowrap"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {timeStart}
                  {task.is_recurring && <span className="ml-0.5">↻</span>}
                </span>
              )}
            </div>
            {showTimeSeparate && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {timeStr}
                {task.is_recurring && <span className="ml-1">↻</span>}
              </p>
            )}
            {showDescription && (
              <p className="truncate text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            )}
            {showProject && (
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {project.name}
                </span>
              </div>
            )}
            {showLabels && (
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {labels.slice(0, 2).map((label) => (
                  <span
                    key={label.id}
                    className="rounded px-1 py-px text-[9px] font-medium"
                    style={{ backgroundColor: label.color + '20', color: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        data-resize-handle
        className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        style={{ height: 7 }}
        onMouseDown={handleResizeStart}
      >
        <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  )
}

/* ── Calendar habit chip (all-day zone, draggable to timeline) ─── */

function CalendarHabitChip({
  habit,
  completions,
  date,
  onToggle,
  onDragStart,
  onEdit,
}: {
  habit: Habit
  completions: HabitCompletion[]
  date: Date
  onToggle: () => void
  onDragStart: (e: React.MouseEvent) => void
  onEdit?: () => void
}) {
  const completed = isCompletedOnDate(completions, habit.id, date)
  const { tooltipHandlers, tooltipPortal } = useHabitTooltip({
    habit,
    completions,
    date,
    scheduledTime: null,
  })

  return (
    <>
      <div
        className="group flex items-center gap-1 rounded px-1 py-0.5 text-[11px] overflow-hidden min-w-0 select-none"
        style={{
          backgroundColor: `${habit.color}15`,
          borderLeft: `2px solid ${habit.color}`,
          opacity: completed ? 0.6 : 1,
          cursor: 'grab',
        }}
        onMouseDown={onDragStart}
        {...tooltipHandlers}
        title="Arrastrá al horario para programar"
      >
        <HabitCheckbox completed={completed} color={habit.color} onChange={onToggle} size="sm" />
        {habit.icon && <span className="shrink-0">{habit.icon}</span>}
        <span
          className="truncate flex-1 min-w-0"
          style={{
            color: 'var(--text-primary)',
            textDecoration: completed ? 'line-through' : 'none',
          }}
        >
          {stripHtmlTags(habit.name)}
        </span>
        <span
          className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
        >
          Hábito
        </span>
        {onEdit && (
          <button
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5"
            style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              onEdit()
            }}
            title="Editar hábito"
          >
            <Pencil size={10} />
          </button>
        )}
      </div>
      {tooltipPortal}
    </>
  )
}

/* ── Calendar habit block (scheduled, draggable in timeline) ───── */

function CalendarHabitBlock({
  habit,
  scheduledTime,
  date,
  completions,
  onReschedule,
  onToggle,
  onUpdateDuration,
  onEdit,
  col = 0,
  totalCols = 1,
}: {
  habit: Habit
  scheduledTime: string
  date: Date
  completions: HabitCompletion[]
  onReschedule: (time: string) => void
  onToggle: () => void
  onUpdateDuration: (mins: number) => void
  onEdit?: () => void
  col?: number
  totalCols?: number
}) {
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const completed = isCompletedOnDate(completions, habit.id, date)

  const serverHour = timeStrToHour(scheduledTime)
  const [localHour, setLocalHour] = useState<number | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  const [activeDragDy, setActiveDragDy] = useState(0)
  const [resizeDelta, setResizeDelta] = useState(0)
  const [interacting, setInteracting] = useState(false)
  const didMove = useRef(false)

  const { tooltipHandlers, tooltipPortal } = useHabitTooltip({
    habit,
    completions,
    date,
    scheduledTime,
    disabled: interacting,
  })

  const baseHour = localHour ?? serverHour
  const baseDuration = localDuration ?? habit.duration_minutes

  useEffect(() => {
    if (localHour !== null && Math.abs(serverHour - localHour) < 0.01) setLocalHour(null)
  }, [scheduledTime, serverHour, localHour])

  const baseTop = (baseHour - START_HOUR) * HOUR_HEIGHT + activeDragDy
  const currentHeight = Math.max(
    (baseDuration / 60) * HOUR_HEIGHT + resizeDelta,
    (MIN_DURATION / 60) * HOUR_HEIGHT,
  )
  const renderHeight = currentHeight

  const displayHours = pxToHours(Math.max(0, baseTop), HOUR_HEIGHT)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const durMin = Math.max(MIN_DURATION, Math.round((currentHeight / HOUR_HEIGHT) * 60))
  const endHours = displayHours + durMin / 60
  const startLabel = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const endLabel = `${String(Math.floor(endHours) % 24).padStart(2, '0')}:${String(Math.round((endHours % 1) * 60) % 60).padStart(2, '0')}`
  const showTime = renderHeight >= 38

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      e.stopPropagation()
      didMove.current = false
      setInteracting(true)
      const startY = e.clientY

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY
        if (Math.abs(delta) > 3) didMove.current = true
        setActiveDragDy(delta)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)

        if (!didMove.current) {
          onEdit?.()
          return
        }

        setActiveDragDy((prev) => {
          if (Math.abs(prev) < 4) return 0
          const newHours = pxToHours((baseHour - START_HOUR) * HOUR_HEIGHT + prev, HOUR_HEIGHT)
          const totalMin = snapMinutes(Math.round(newHours * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - baseDuration))
          const snappedHour = clampedMin / 60
          setLocalHour(snappedHour)
          onReschedule(hourToTimeStr(snappedHour))
          return 0
        })
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseHour, baseDuration, HOUR_HEIGHT, onReschedule, onEdit],
  )

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setInteracting(true)
      const startY = e.clientY

      const onMove = (ev: MouseEvent) => setResizeDelta(ev.clientY - startY)
      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)
        setResizeDelta((prev) => {
          if (Math.abs(prev) < 4) return 0
          const newPx = Math.max(
            (MIN_DURATION / 60) * HOUR_HEIGHT,
            (baseDuration / 60) * HOUR_HEIGHT + prev,
          )
          const snapped = Math.max(
            MIN_DURATION,
            snapMinutes(Math.round((newPx / HOUR_HEIGHT) * 60)),
          )
          setLocalDuration(snapped)
          onUpdateDuration(snapped)
          return 0
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseDuration, HOUR_HEIGHT, onUpdateDuration],
  )

  return (
    <>
      <div
        className={cn(
          'group absolute z-10 select-none overflow-hidden rounded-md border-l-2 px-1.5 py-0.5',
          completed && 'opacity-50',
          interacting
            ? 'shadow-lg z-30 cursor-grabbing'
            : 'cursor-pointer opacity-90 hover:opacity-100',
        )}
        style={{
          top: Math.max(0, baseTop),
          height: renderHeight,
          borderLeftColor: habit.color,
          backgroundColor: `${habit.color}1A`,
          transition: interacting ? 'none' : 'top 0.15s ease, height 0.15s ease',
          ...overlapPos(col, totalCols),
        }}
        onMouseDown={handleDragStart}
        {...tooltipHandlers}
      >
        <div className="flex items-center gap-1">
          <HabitCheckbox completed={completed} color={habit.color} onChange={onToggle} size="sm" />
          {habit.icon && <span className="shrink-0 text-[10px]">{habit.icon}</span>}
          <p
            className={cn(
              'truncate text-[11px] font-medium leading-tight flex-1 min-w-0',
              completed && 'line-through',
            )}
            style={{ color: 'var(--text-primary)' }}
          >
            {stripHtmlTags(habit.name)}
          </p>
          <span
            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
          >
            Hábito
          </span>
        </div>
        {showTime && (
          <p className="text-[10px]" style={{ color: `${habit.color}BB` }}>
            {startLabel}–{endLabel}
          </p>
        )}

        {/* Resize handle */}
        <div
          data-resize-handle
          className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ height: 7 }}
          onMouseDown={handleResizeStart}
        >
          <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: habit.color }} />
        </div>
      </div>
      {tooltipPortal}
    </>
  )
}

/* ── All-day chip ──────────────────────────────────────── */

function AllDayChip({
  task,
  onMouseEnter,
  onMouseLeave,
}: {
  task: Task
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
}) {
  const completeTask = useCompleteTask()
  const { setSelectedTaskId } = useAppStore()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]
  const isVirtual = task.id.includes('::')

  return (
    <div
      className={cn(
        'mb-0.5 flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] overflow-hidden min-w-0',
        task.is_completed && 'opacity-50',
        isVirtual && 'opacity-70',
      )}
      style={{
        backgroundColor: `${color}20`,
        ...(isVirtual ? { outline: `1px dashed ${color}60` } : {}),
      }}
      onClick={() => setSelectedTaskId(originalTaskId(task.id))}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TaskCheckbox
        checked={task.is_completed}
        priority={task.priority}
        onChange={
          isVirtual ? () => {} : (completed) => completeTask.mutate({ id: task.id, completed })
        }
      />
      <span
        className={cn('truncate min-w-0 flex-1', task.is_completed && 'line-through')}
        style={{ color: 'var(--text-primary)' }}
      >
        {stripLabelTokensFromText(stripHtmlTags(task.title))}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Month Day Cell
   ═══════════════════════════════════════════════════════ */

interface MonthDayCellProps {
  day: Date
  dateStr: string
  tasks: Task[]
  calendarEvents?: CalendarEvent[]
  habits?: Habit[]
  isTodayDate: boolean
  inCurrentMonth: boolean
  isOver: boolean
  hasRightBorder: boolean
  onAddTask: (dateStr: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragOver: (e: React.DragEvent, dateStr: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, dateStr: string) => void
  onEditEvent: (event: CalendarEvent) => void
  onEditHabit?: (habit: Habit, date: Date) => void
  onCreateEvent: (date: Date, hour: number) => void
}

function MonthDayCell({
  day,
  dateStr,
  tasks,
  calendarEvents = [],
  habits = [],
  isTodayDate,
  inCurrentMonth,
  isOver,
  hasRightBorder,
  onAddTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditEvent,
  onEditHabit,
  onCreateEvent,
}: MonthDayCellProps) {
  const [hovered, setHovered] = useState(false)
  const maxVisible = 3
  const totalItems = tasks.length + calendarEvents.length + habits.length
  const visibleTasks = tasks.slice(0, maxVisible)
  const remainingSlots = Math.max(0, maxVisible - visibleTasks.length)
  const visibleEvents = calendarEvents.slice(0, remainingSlots)
  const remainingAfterEvents = Math.max(0, remainingSlots - visibleEvents.length)
  const visibleHabits = habits.slice(0, remainingAfterEvents)
  const overflow = totalItems - visibleTasks.length - visibleEvents.length - visibleHabits.length
  const visible = visibleTasks

  return (
    <div
      className="relative flex flex-col p-1.5 transition-colors select-none min-h-[108px] overflow-hidden"
      style={{
        borderRight: hasRightBorder ? '1px solid var(--border-secondary)' : 'none',
        backgroundColor: isOver
          ? 'var(--bg-active)'
          : !inCurrentMonth
            ? 'var(--bg-secondary)'
            : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={(e) => onDragOver(e, dateStr)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, dateStr)}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{
            backgroundColor: isTodayDate ? 'var(--color-primary)' : 'transparent',
            color: isTodayDate
              ? '#fff'
              : inCurrentMonth
                ? 'var(--text-primary)'
                : 'var(--text-muted)',
          }}
        >
          {format(day, 'd')}
        </div>
        {hovered && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => onCreateEvent(day, 9)}
              className="rounded-full p-0.5 transition-opacity hover:opacity-60"
              style={{ color: '#4285F4' }}
              title={`Nuevo evento de calendario para el ${dateStr}`}
            >
              <Plus size={11} />
            </button>
            <button
              onClick={() => onAddTask(dateStr)}
              className="rounded-full p-0.5 transition-opacity hover:opacity-60"
              style={{ color: 'var(--text-muted)' }}
              title={`Agregar tarea para el ${dateStr}`}
            >
              <Plus size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {visible.map((task) => (
          <TaskTooltip key={task.id} task={task}>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs cursor-grab active:cursor-grabbing overflow-hidden min-w-0 transition-opacity hover:opacity-80"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] + '20' }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
              />
              <span
                className={cn(
                  'truncate min-w-0 flex-1',
                  task.is_completed && 'line-through opacity-50',
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                {stripLabelTokensFromText(stripHtmlTags(task.title))}
              </span>
            </div>
          </TaskTooltip>
        ))}
        {visibleEvents.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs overflow-hidden min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: (ev.calendarColor ?? GOOGLE_COLOR) + '1A' }}
            title={ev.isAllDay ? ev.title : `${format(ev.start, 'HH:mm')} ${ev.title}`}
            onClick={() => onEditEvent(ev)}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: ev.calendarColor ?? GOOGLE_COLOR }}
            />
            <span className="truncate min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
              {ev.title}
            </span>
          </div>
        ))}
        {visibleHabits.map((habit) => (
          <div
            key={habit.id}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs overflow-hidden min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: `${habit.color}18`, borderLeft: `2px solid ${habit.color}` }}
            title={stripHtmlTags(habit.name)}
            onClick={() => onEditHabit?.(habit, day)}
          >
            {habit.icon && <span className="shrink-0">{habit.icon}</span>}
            <span className="truncate min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
              {stripHtmlTags(habit.name)}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <p className="px-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            +{overflow} más
          </p>
        )}
      </div>
    </div>
  )
}
