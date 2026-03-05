import { useMemo, useEffect, useRef, useState, useCallback, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import { Calendar, CheckSquare, X, AlertCircle, Pencil } from 'lucide-react'
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks'
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
} from '@/hooks/useHabits'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { HabitCheckbox } from '@/components/habits/HabitCheckbox'
import { useHabitTooltip } from '@/components/habits/HabitTooltip'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { PRIORITY_COLORS } from '@/lib/constants'
import { cn, stripHtmlTags, stripLabelTokensFromText } from '@/lib/utils'
import { TaskTooltip } from '@/components/common/TaskTooltip'
import { CalendarEventEditor } from '@/components/common/CalendarEventEditor'
import type { Task, Label, CalendarEvent, Habit, HabitCompletion } from '@/lib/types'
import {
  CalendarEventTooltip,
  getEventColor,
  getCalendarName,
} from '@/components/common/CalendarEventTooltip'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
  habitAppearsOnDate,
  getScheduledTimeForDate,
  timeStrToHour,
  hourToTimeStr,
  isCompletedOnDate,
} from '@/lib/habitUtils'

const HOUR_HEIGHT = 100 // px per hour (desktop)

/** Context that provides the effective HOUR_HEIGHT to sub-components */
const HourHeightCtx = createContext(HOUR_HEIGHT)
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const SNAP_MINUTES = 15 // snap to 15-min increments
const MIN_DURATION = 15 // minimum 15 minutes

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

interface TodayCalendarViewProps {
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
  calendarEvents?: CalendarEvent[]
  showCompleted?: boolean
  showHabits?: boolean
}

/** Convert a pixel offset (relative to grid top) to fractional hours */
function pxToHours(px: number, hourHeight: number = HOUR_HEIGHT): number {
  return START_HOUR + px / hourHeight
}

/** Snap minutes to nearest SNAP_MINUTES */
function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function TodayCalendarView({
  tasks,
  calendarEvents = [],
  showCompleted = true,
  showHabits = true,
}: TodayCalendarViewProps) {
  const isMobile = useIsMobile()
  const hourHeight = isMobile ? 40 : HOUR_HEIGHT
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())

  const { setSelectedHabit } = useAppStore()

  // Editor state
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [creatingEventInfo, setCreatingEventInfo] = useState<{
    date: Date
    hour: number
    durationMinutes?: number
  } | null>(null)
  const [creatingTaskInfo, setCreatingTaskInfo] = useState<{
    date: string
    time: string
    durationMinutes: number
  } | null>(null)

  // Drag-to-create state
  const [createDrag, setCreateDrag] = useState<{
    startHour: number
    currentHour: number
    startY: number
  } | null>(null)
  const [typePicker, setTypePicker] = useState<{
    startHour: number
    durationMinutes: number
    screenX: number
    screenY: number
  } | null>(null)

  // Habit data
  const today = new Date()
  const todayDateStr = format(today, 'yyyy-MM-dd')
  const { data: allHabits = [] } = useHabits()
  const { data: habitCompletions = [] } = useHabitCompletions(todayDateStr, todayDateStr)
  const { data: habitSchedules = [] } = useHabitSchedules(todayDateStr, todayDateStr)
  const toggleHabitCompletion = useToggleHabitCompletion()
  const setHabitDefaultTime = useSetHabitDefaultTime()
  const upsertHabitSchedule = useUpsertHabitSchedule()

  const todayHabits = useMemo(() => {
    if (!showHabits) return []
    return allHabits.filter((h) => {
      if (!habitAppearsOnDate(h, today)) return false
      if (!showCompleted && isCompletedOnDate(habitCompletions, h.id, today)) return false
      return true
    })
  }, [allHabits, todayDateStr, showCompleted, showHabits, habitCompletions])
  const unscheduledHabits = useMemo(
    () => todayHabits.filter((h) => getScheduledTimeForDate(h, habitSchedules, today) === null),
    [todayHabits, habitSchedules],
  )
  const scheduledHabits = useMemo(
    () => todayHabits.filter((h) => getScheduledTimeForDate(h, habitSchedules, today) !== null),
    [todayHabits, habitSchedules],
  )

  // Habit drag state (from all-day zone to timeline)
  const [habitDrag, setHabitDrag] = useState<{ habit: Habit; ghostHour: number | null } | null>(
    null,
  )
  const habitDragRef = useRef(habitDrag)
  useEffect(() => {
    habitDragRef.current = habitDrag
  }, [habitDrag])

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Scroll to current time on mount
  useEffect(() => {
    if (nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [])

  // Habit drag from all-day chip to timeline
  const startHabitDrag = useCallback(
    (habit: Habit, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setHabitDrag({ habit, ghostHour: null })

      const onMove = (ev: MouseEvent) => {
        if (!gridRef.current) return
        const rect = gridRef.current.getBoundingClientRect()
        const scrollTop = containerRef.current?.scrollTop ?? 0
        const y = ev.clientY - rect.top + scrollTop
        if (y < 0) {
          setHabitDrag((p) => (p ? { ...p, ghostHour: null } : null))
          return
        }
        const rawHour = pxToHours(y, hourHeight)
        const snappedMin = snapMinutes(Math.round(rawHour * 60))
        const snapped = Math.max(START_HOUR, snappedMin / 60)
        setHabitDrag((p) => (p ? { ...p, ghostHour: snapped } : null))
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        const state = habitDragRef.current
        if (!state?.ghostHour) {
          setHabitDrag(null)
          return
        }
        const time = hourToTimeStr(state.ghostHour)
        if (!state.habit.scheduled_time) {
          setHabitDefaultTime.mutate({ habitId: state.habit.id, time })
        } else {
          upsertHabitSchedule.mutate({ habitId: state.habit.id, date: todayDateStr, time })
        }
        setHabitDrag(null)
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [hourHeight, todayDateStr, setHabitDefaultTime, upsertHabitSchedule],
  )

  // Split tasks into three buckets:
  // - overdueTasks: due_date < today (regardless of has_time)
  // - allDayTasks: due today but no specific time
  // - timedTasks: due today AND has a specific time → positioned on timeline
  const { overdueTasks, allDayTasks, timedTasks } = useMemo(() => {
    const overdue: Task[] = []
    const allDay: Task[] = []
    const timed: Task[] = []
    tasks.forEach((t) => {
      if (t.due_date && t.due_date < todayDateStr) {
        overdue.push(t)
      } else if (t.has_time && t.due_datetime && t.due_date === todayDateStr) {
        timed.push(t)
      } else {
        allDay.push(t)
      }
    })
    return { overdueTasks: overdue, allDayTasks: allDay, timedTasks: timed }
  }, [tasks, todayDateStr])

  const allDayEvents = calendarEvents.filter((e) => e.isAllDay)
  const timedEvents = calendarEvents.filter((e) => !e.isAllDay)
  const hasAllDaySection =
    allDayTasks.length > 0 || allDayEvents.length > 0 || unscheduledHabits.length > 0

  // Calcula columnas de overlap para todos los bloques con hora en el timeline
  const timedLayout = useMemo(() => {
    const items: { id: string; startH: number; endH: number }[] = []
    for (const task of timedTasks) {
      const dt = new Date(task.due_datetime!)
      const startH = dt.getHours() + dt.getMinutes() / 60
      const dur = task.duration_minutes ?? 60
      items.push({ id: task.id, startH, endH: startH + dur / 60 })
    }
    for (const event of timedEvents) {
      const startH = event.start.getHours() + event.start.getMinutes() / 60
      const endH = event.end.getHours() + event.end.getMinutes() / 60
      items.push({ id: event.id, startH, endH: Math.max(startH + MIN_DURATION / 60, endH) })
    }
    for (const habit of scheduledHabits) {
      const time = getScheduledTimeForDate(habit, habitSchedules, new Date(todayDateStr))
      if (!time) continue
      const startH = timeStrToHour(time)
      items.push({ id: habit.id, startH, endH: startH + habit.duration_minutes / 60 })
    }
    return computeOverlapLayout(items)
  }, [timedTasks, timedEvents, scheduledHabits, habitSchedules, todayDateStr])

  // Current time position
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowTop = (nowHour - START_HOUR) * hourHeight
  const nowLabel = format(now, 'HH:mm')

  // Drag-to-create: mousedown starts the gesture
  const handleBackdropMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!gridRef.current) return
      e.preventDefault()
      const rect = gridRef.current.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const hour = Math.max(0, Math.min(pxToHours(relY, hourHeight), 23.75))
      setCreateDrag({ startHour: hour, currentHour: hour, startY: e.clientY })
    },
    [hourHeight],
  )

  // Drag-to-create: mousemove + mouseup on window
  useEffect(() => {
    if (!createDrag) return
    const onMove = (e: MouseEvent) => {
      if (!gridRef.current) return
      const rect = gridRef.current.getBoundingClientRect()
      const relY = e.clientY - rect.top
      const rawHour = Math.max(createDrag.startHour, Math.min(pxToHours(relY, hourHeight), 24))
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

  return (
    <HourHeightCtx.Provider value={hourHeight}>
      <>
        <div className="flex flex-col">
          {/* Overdue section */}
          {overdueTasks.length > 0 && (
            <div className="mb-2">
              <div className="flex">
                <div
                  className="w-14 shrink-0 pr-2 pt-1 text-right text-xs font-medium"
                  style={{ color: 'var(--color-accent)' }}
                >
                  Vencidas
                </div>
                <div
                  className="flex-1 rounded-lg border-l-2 py-1 pl-2"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-accent) 27%, transparent)',
                    backgroundColor: 'color-mix(in srgb, var(--color-accent) 4%, transparent)',
                  }}
                >
                  {overdueTasks.map((task) => (
                    <TaskTooltip key={task.id} task={task}>
                      <OverdueTaskCard task={task} />
                    </TaskTooltip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* All-day section */}
          {hasAllDaySection && (
            <div className="mb-2">
              <div className="flex">
                <div
                  className="w-14 shrink-0 pr-2 pt-1 text-right text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Todo el día
                </div>
                <div
                  className="flex-1 border-l py-1 pl-2"
                  style={{ borderColor: 'var(--border-secondary)' }}
                >
                  {allDayTasks.map((task) => (
                    <TaskTooltip key={task.id} task={task}>
                      <TimelineTaskCard task={task} />
                    </TaskTooltip>
                  ))}
                  {allDayEvents.map((event) => (
                    <AllDayEventChip
                      key={event.id}
                      event={event}
                      onEdit={() => setEditingEvent(event)}
                    />
                  ))}
                  {/* Habit chips for unscheduled habits */}
                  {unscheduledHabits.map((habit) => (
                    <HabitChip
                      key={habit.id}
                      habit={habit}
                      completions={habitCompletions}
                      date={today}
                      onToggle={() =>
                        toggleHabitCompletion.mutate({ habitId: habit.id, date: today })
                      }
                      onDragStart={(e) => startHabitDrag(habit, e)}
                      onEdit={() => setSelectedHabit(habit.id, todayDateStr)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div
            ref={containerRef}
            className="relative overflow-y-auto"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            <div className="flex">
              {/* Hour labels */}
              <div className="w-14 shrink-0">
                {Array.from({ length: TOTAL_HOURS }, (_, i) => {
                  const hour = START_HOUR + i
                  return (
                    <div
                      key={hour}
                      className="relative pr-2 text-right text-xs"
                      style={{ height: hourHeight, color: 'var(--text-muted)' }}
                    >
                      <span className="relative -top-2">
                        {`${hour.toString().padStart(2, '0')}:00`}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Grid + events */}
              <div ref={gridRef} className="relative flex-1 cursor-crosshair">
                {/* Backdrop for drag-to-create (behind task/event blocks) */}
                <div
                  className="absolute inset-0 z-0 cursor-crosshair"
                  onMouseDown={handleBackdropMouseDown}
                />

                {/* Creation ghost preview during drag */}
                {createDrag && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 z-20 rounded-md"
                    style={{
                      top: (createDrag.startHour - START_HOUR) * hourHeight,
                      height:
                        Math.max(MIN_DURATION / 60, createDrag.currentHour - createDrag.startHour) *
                        hourHeight,
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
                    style={{ height: hourHeight, borderColor: 'var(--border-secondary)' }}
                  />
                ))}

                {/* Now indicator */}
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
                  <span
                    className="ml-1 text-[10px] font-semibold"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {nowLabel}
                  </span>
                </div>

                {/* Timed tasks */}
                {timedTasks.map((task) => {
                  const layout = timedLayout.get(task.id)
                  return (
                    <TaskTooltip key={task.id} task={task}>
                      <TimedTaskBlock task={task} col={layout?.col} totalCols={layout?.totalCols} />
                    </TaskTooltip>
                  )
                })}

                {/* Timed calendar events (draggable) */}
                {timedEvents.map((event) => {
                  const layout = timedLayout.get(event.id)
                  return (
                    <TimedEventBlock
                      key={event.id}
                      event={event}
                      onEdit={() => setEditingEvent(event)}
                      col={layout?.col}
                      totalCols={layout?.totalCols}
                    />
                  )
                })}

                {/* Scheduled habit blocks */}
                {scheduledHabits.map((habit) => {
                  const scheduledTime = getScheduledTimeForDate(habit, habitSchedules, today)!
                  const layout = timedLayout.get(habit.id)
                  return (
                    <TimedHabitBlock
                      key={habit.id}
                      habit={habit}
                      scheduledTime={scheduledTime}
                      date={today}
                      completions={habitCompletions}
                      hourHeight={hourHeight}
                      onReschedule={(time) =>
                        upsertHabitSchedule.mutate({ habitId: habit.id, date: todayDateStr, time })
                      }
                      onToggle={() =>
                        toggleHabitCompletion.mutate({ habitId: habit.id, date: today })
                      }
                      onEdit={() => setSelectedHabit(habit.id, todayDateStr)}
                      col={layout?.col}
                      totalCols={layout?.totalCols}
                    />
                  )
                })}

                {/* Ghost preview while dragging a habit chip */}
                {habitDrag?.ghostHour !== null && habitDrag?.ghostHour !== undefined && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 z-20 rounded-md border-l-2"
                    style={{
                      top: (habitDrag.ghostHour - START_HOUR) * hourHeight,
                      height: (habitDrag.habit.duration_minutes / 60) * hourHeight,
                      backgroundColor: `${habitDrag.habit.color}25`,
                      borderLeftColor: habitDrag.habit.color,
                      opacity: 0.8,
                    }}
                  >
                    <p
                      className="truncate px-2 py-0.5 text-xs font-medium"
                      style={{ color: habitDrag.habit.color }}
                    >
                      {habitDrag.habit.icon && `${habitDrag.habit.icon} `}
                      {stripHtmlTags(habitDrag.habit.name)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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

        {/* Type picker popup after drag */}
        {typePicker &&
          createPortal(
            <CreationTypePicker
              startHour={typePicker.startHour}
              durationMinutes={typePicker.durationMinutes}
              screenX={typePicker.screenX}
              screenY={typePicker.screenY}
              onEvent={() => {
                setCreatingEventInfo({
                  date: new Date(),
                  hour: typePicker.startHour,
                  durationMinutes: typePicker.durationMinutes,
                })
                setTypePicker(null)
              }}
              onTask={() => {
                const h = Math.floor(typePicker.startHour)
                const m = Math.round((typePicker.startHour - h) * 60)
                const dateStr = format(new Date(), 'yyyy-MM-dd')
                setCreatingTaskInfo({
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
      </>
    </HourHeightCtx.Provider>
  )
}

// ── Creation type picker popup ─────────────────────────────────────────────────

function fmtHour(fractionalHour: number): string {
  const h = Math.floor(fractionalHour) % 24
  const m = Math.round((fractionalHour - Math.floor(fractionalHour)) * 60)
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function CreationTypePicker({
  startHour,
  durationMinutes,
  screenX,
  screenY,
  onEvent,
  onTask,
  onClose,
}: {
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
  const timeLabel = `${fmtHour(startHour)} – ${fmtHour(endHour)}`

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

/* ── Timed task block (draggable + resizable) ────────── */

function TimedTaskBlock({
  task,
  onMouseEnter,
  onMouseLeave,
  col = 0,
  totalCols = 1,
}: {
  task: Task
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  col?: number
  totalCols?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const updateTask = useUpdateTask()
  const completeTask = useCompleteTask()
  const { setSelectedTaskId } = useAppStore()
  const { data: projects } = useProjects()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]

  const dt = new Date(task.due_datetime!)
  const serverHour = dt.getHours() + dt.getMinutes() / 60
  const serverDuration = task.duration_minutes || 60

  // Local overrides that persist after drop until server data arrives
  const [localHour, setLocalHour] = useState<number | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)

  // Live drag/resize offsets (px, only non-zero while actively dragging)
  const [dragOffset, setDragOffset] = useState(0)
  const [resizeDelta, setResizeDelta] = useState(0)
  const [interacting, setInteracting] = useState(false)
  const didMove = useRef(false)

  // When server data catches up to local override, clear the override
  const baseHour = localHour ?? serverHour
  const baseDuration = localDuration ?? serverDuration

  useEffect(() => {
    if (localHour !== null) {
      const sH = dt.getHours() + dt.getMinutes() / 60
      if (Math.abs(sH - localHour) < 0.01) setLocalHour(null)
    }
  }, [task.due_datetime, dt, localHour])

  useEffect(() => {
    if (localDuration !== null) {
      const sD = task.duration_minutes || 60
      if (sD === localDuration) setLocalDuration(null)
    }
  }, [task.duration_minutes, localDuration])

  const currentTop = (baseHour - START_HOUR) * HOUR_HEIGHT + dragOffset
  const currentHeight = Math.max(
    (baseDuration / 60) * HOUR_HEIGHT + resizeDelta,
    (MIN_DURATION / 60) * HOUR_HEIGHT,
  )
  const renderHeight = currentHeight

  // Computed display times
  const displayHours = pxToHours(currentTop, HOUR_HEIGHT)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const displayDurationMin = Math.max(MIN_DURATION, Math.round((currentHeight / HOUR_HEIGHT) * 60))
  const endHours = displayHours + displayDurationMin / 60
  const endH = Math.floor(endHours)
  const endM = Math.round((endHours - endH) * 60)

  const timeStart = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const timeEnd = `${String(Math.min(endH, 23)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
  const timeStr = `${timeStart}–${timeEnd}`

  const project = projects?.find((p) => p.id === task.project_id)
  const labels = labelsMap?.get(task.id) ?? []
  const description = task.description ? stripHtmlTags(task.description).trim() : ''

  // Progressive thresholds (px) — HOUR_HEIGHT=100
  const isCompact = renderHeight < 30
  const showTimeSeparate = !isCompact && renderHeight >= 42
  const showDescription = renderHeight >= 64 && description
  const showProject = renderHeight >= 84 && project
  const showLabels = renderHeight >= 104 && labels.length > 0

  /* ── Drag to move ── */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      if ((e.target as HTMLElement).closest('button')) return

      e.preventDefault()
      e.stopPropagation()
      didMove.current = false
      setInteracting(true)
      const startYVal = e.clientY

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startYVal
        if (Math.abs(delta) > 3) didMove.current = true
        setDragOffset(delta)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)

        setDragOffset((prev) => {
          if (Math.abs(prev) < 4) return 0

          const newHours = pxToHours((baseHour - START_HOUR) * HOUR_HEIGHT + prev, HOUR_HEIGHT)
          const totalMin = snapMinutes(Math.round(newHours * 60))
          const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - baseDuration))
          const newH = Math.floor(clampedMin / 60)
          const newM = clampedMin % 60
          const snappedHour = newH + newM / 60

          setLocalHour(snappedHour)

          const newDt = new Date(dt)
          newDt.setHours(newH, newM, 0, 0)
          updateTask.mutate({
            id: task.id,
            updates: { due_datetime: newDt.toISOString() },
          })

          return 0
        })
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseHour, baseDuration, dt, task.id, updateTask],
  )

  /* ── Resize to change duration ── */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      didMove.current = false
      setInteracting(true)
      const startYVal = e.clientY

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startYVal
        if (Math.abs(delta) > 3) didMove.current = true
        setResizeDelta(delta)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)

        setResizeDelta((prev) => {
          if (Math.abs(prev) < 4) return 0

          const newHeightPx = Math.max(
            (MIN_DURATION / 60) * HOUR_HEIGHT,
            (baseDuration / 60) * HOUR_HEIGHT + prev,
          )
          const rawMin = (newHeightPx / HOUR_HEIGHT) * 60
          const snapped = Math.max(MIN_DURATION, snapMinutes(Math.round(rawMin)))

          setLocalDuration(snapped)

          updateTask.mutate({
            id: task.id,
            updates: { duration_minutes: snapped },
          })

          return 0
        })
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseDuration, task.id, updateTask],
  )

  const handleClick = () => {
    if (!didMove.current) {
      setSelectedTaskId(task.id)
    }
  }

  return (
    <div
      className={cn(
        'group absolute left-1 right-2 z-10 select-none overflow-hidden rounded-md border-l-3',
        isCompact ? 'px-1.5 py-0' : 'px-2 py-1',
        task.is_completed && 'opacity-50',
        interacting ? 'shadow-lg z-30' : 'cursor-pointer',
      )}
      style={{
        top: currentTop,
        height: renderHeight,
        borderLeftColor: color,
        backgroundColor: `${color}18`,
        transition: interacting ? 'none' : 'top 0.15s ease, height 0.15s ease',
        ...overlapPos(col, totalCols),
      }}
      onMouseDown={handleDragStart}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {isCompact ? (
        /* ── Compact mode: single row, no checkbox ── */
        <div className="flex items-center gap-1 h-full">
          <span className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          <p
            className={cn(
              'truncate text-[10px] font-medium flex-1 min-w-0 leading-none',
              task.is_completed && 'line-through',
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
        <div className="flex items-start gap-1.5">
          <div className="mt-0.5">
            <TaskCheckbox
              checked={task.is_completed}
              priority={task.priority}
              onChange={(completed) => completeTask.mutate({ id: task.id, completed })}
            />
          </div>
          <div className="min-w-0 flex-1">
            {/* Title row — always shows time inline when block is short */}
            <div className="flex items-center gap-1">
              <p
                className={cn(
                  'truncate text-xs font-medium flex-1 min-w-0',
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
            {/* Time on separate line when tall enough */}
            {showTimeSeparate && (
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {timeStr}
                {task.is_recurring && <span className="ml-1">↻</span>}
              </p>
            )}
            {/* Description */}
            {showDescription && (
              <p className="truncate text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            )}
            {/* Project */}
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
            {/* Labels */}
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

      {/* Resize handle at the bottom */}
      <div
        data-resize-handle
        className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        style={{ height: 8 }}
        onMouseDown={handleResizeStart}
      >
        <div className="h-1 w-8 rounded-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  )
}

/* ── Timed calendar event block (draggable + resizable + clickable) ─────── */

function TimedEventBlock({
  event,
  onEdit,
  col = 0,
  totalCols = 1,
}: {
  event: CalendarEvent
  onEdit: () => void
  col?: number
  totalCols?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const HOUR_HEIGHT = useContext(HourHeightCtx)
  const { updateEvent } = useCalendarEventMutations()
  const color = getEventColor(event)
  const calendarName = getCalendarName(event)

  // Clip cross-day events: if the event started before today, treat today 00:00 as the start
  const todayMidnight = new Date()
  todayMidnight.setHours(0, 0, 0, 0)
  const effectiveStart = event.start < todayMidnight ? todayMidnight : event.start
  const serverStartHour = effectiveStart.getHours() + effectiveStart.getMinutes() / 60
  const serverDuration = Math.max(
    (event.end.getTime() - effectiveStart.getTime()) / 60_000,
    MIN_DURATION,
  )

  // Local optimistic overrides
  const [localStartHour, setLocalStartHour] = useState<number | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [resizeDelta, setResizeDelta] = useState(0)
  const [interacting, setInteracting] = useState(false)
  const didMove = useRef(false)

  const baseHour = localStartHour ?? serverStartHour
  const baseDuration = localDuration ?? serverDuration

  // Clear local overrides when server data matches
  useEffect(() => {
    if (localStartHour !== null) {
      const diff = Math.abs(serverStartHour - localStartHour)
      if (diff < 0.26) setLocalStartHour(null) // within ~15 min
    }
  }, [event.start, serverStartHour, localStartHour])

  useEffect(() => {
    if (localDuration !== null) {
      const diff = Math.abs(serverDuration - localDuration)
      if (diff < 16) setLocalDuration(null)
    }
  }, [event.end, serverDuration, localDuration])

  const top = (baseHour - START_HOUR) * HOUR_HEIGHT + dragOffset
  const height = Math.max(
    (baseDuration / 60) * HOUR_HEIGHT + resizeDelta,
    (MIN_DURATION / 60) * HOUR_HEIGHT,
  )
  const renderHeight = height

  // Display strings
  const displayHours = pxToHours(Math.max(0, top), HOUR_HEIGHT)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const durMin = Math.max(MIN_DURATION, Math.round((height / HOUR_HEIGHT) * 60))
  const endHours = displayHours + durMin / 60
  const endH = Math.floor(endHours)
  const endM = Math.round((endHours % 1) * 60) % 60
  const startStr = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const endStr = `${String(endH % 24).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

  const showTime = renderHeight >= 42
  const showCalendarName = renderHeight >= 58

  /* ── Drag to move ── */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      e.preventDefault()
      e.stopPropagation()
      didMove.current = false
      setInteracting(true)
      const startY = e.clientY
      let latestDelta = 0

      const onMove = (ev: MouseEvent) => {
        latestDelta = ev.clientY - startY
        if (Math.abs(latestDelta) > 3) didMove.current = true
        setDragOffset(latestDelta)
      }

      const onUp = async () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)
        setDragOffset(0)

        if (!didMove.current || Math.abs(latestDelta) < 4) {
          onEdit()
          return
        }

        const newHours = pxToHours((baseHour - START_HOUR) * HOUR_HEIGHT + latestDelta, HOUR_HEIGHT)
        const totalMin = snapMinutes(Math.round(newHours * 60))
        const clampedMin = Math.max(0, Math.min(totalMin, 24 * 60 - baseDuration))
        const newH = Math.floor(clampedMin / 60)
        const newM = clampedMin % 60
        const snappedHour = newH + newM / 60

        setLocalStartHour(snappedHour)

        const newStart = new Date(event.start)
        newStart.setHours(newH, newM, 0, 0)
        const newEnd = new Date(newStart.getTime() + baseDuration * 60_000)

        if (event.calendarId) {
          try {
            await updateEvent.mutateAsync({
              eventId: event.id,
              calendarId: event.calendarId,
              start: newStart,
              end: newEnd,
            })
          } catch (err) {
            setLocalStartHour(null)
            const msg =
              err instanceof Error && err.message === 'PERMISSION_DENIED'
                ? 'Sin permiso para editar este evento. Reconecta Google Calendar con permisos de escritura.'
                : 'No se pudo mover el evento. Intenta de nuevo.'
            toast.error(msg)
          }
        }
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseHour, baseDuration, event, onEdit, updateEvent],
  )

  /* ── Resize to change duration ── */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setInteracting(true)
      const startY = e.clientY
      let latestDelta = 0

      const onMove = (ev: MouseEvent) => {
        latestDelta = ev.clientY - startY
        setResizeDelta(latestDelta)
      }

      const onUp = async () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)
        setResizeDelta(0)

        if (Math.abs(latestDelta) < 4) return

        const newPx = Math.max(
          (MIN_DURATION / 60) * HOUR_HEIGHT,
          (baseDuration / 60) * HOUR_HEIGHT + latestDelta,
        )
        const snapped = Math.max(MIN_DURATION, snapMinutes(Math.round((newPx / HOUR_HEIGHT) * 60)))
        setLocalDuration(snapped)

        const newEnd = new Date(event.start.getTime() + snapped * 60_000)
        if (event.calendarId) {
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

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseDuration, event, updateEvent],
  )

  const blockStyle: React.CSSProperties = {
    top: Math.max(0, top),
    height: renderHeight,
    borderLeftColor: color,
    backgroundColor: `${color}22`,
    transition: interacting ? 'none' : 'top 0.15s ease, height 0.15s ease',
    ...overlapPos(col, totalCols),
  }

  return (
    <CalendarEventTooltip event={event} disabled={interacting}>
      <div
        className={cn(
          'group absolute left-1 right-2 z-10 select-none overflow-hidden rounded-md border-l-3 px-2 py-1 opacity-90 hover:opacity-100',
          interacting ? 'shadow-lg z-30 cursor-grabbing' : 'cursor-pointer',
        )}
        style={blockStyle}
        onMouseDown={handleDragStart}
      >
        {/* Event badge indicator */}
        <div className="flex items-center gap-1 mb-px">
          <span
            className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <p className="truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {event.title}
          </p>
        </div>
        {showTime && (
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {startStr}–{endStr}
          </p>
        )}
        {showCalendarName && (
          <p className="truncate text-[10px]" style={{ color: `${color}CC` }}>
            {calendarName}
          </p>
        )}

        {/* Resize handle */}
        <div
          data-resize-handle
          className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ height: 8 }}
          onMouseDown={handleResizeStart}
        >
          <div className="h-1 w-8 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </div>
    </CalendarEventTooltip>
  )
}

/* ── All-day calendar event chip ────────────────── */

function AllDayEventChip({ event, onEdit }: { event: CalendarEvent; onEdit: () => void }) {
  const color = getEventColor(event)
  const calendarName = getCalendarName(event)

  return (
    <CalendarEventTooltip event={event}>
      <div
        className="mb-1 flex items-center gap-1.5 overflow-hidden min-w-0 rounded-md px-2 py-1 text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
        style={{ backgroundColor: `${color}22`, borderLeft: `2px solid ${color}` }}
        onClick={onEdit}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </span>
        <span className="ml-auto shrink-0 text-[10px] font-normal" style={{ color: `${color}BB` }}>
          {calendarName}
        </span>
      </div>
    </CalendarEventTooltip>
  )
}

/* ── Overdue task card ──────────────────────────── */

function OverdueTaskCard({ task }: { task: Task }) {
  const completeTask = useCompleteTask()
  const { setSelectedTaskId } = useAppStore()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]

  const dateLabel = task.due_date
    ? format(new Date(task.due_date + 'T12:00:00'), "d 'de' MMM", { locale: es })
    : ''
  const timeLabel =
    task.has_time && task.due_datetime ? format(new Date(task.due_datetime), 'HH:mm') : null

  return (
    <div
      className={cn(
        'mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        task.is_completed && 'opacity-50',
      )}
      style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 6%, transparent)' }}
      onClick={() => setSelectedTaskId(task.id)}
    >
      <TaskCheckbox
        checked={task.is_completed}
        priority={task.priority}
        onChange={(completed) => completeTask.mutate({ id: task.id, completed })}
      />
      <span
        className={cn('flex-1 truncate text-xs font-medium', task.is_completed && 'line-through')}
        style={{ color: 'var(--text-primary)' }}
      >
        {stripLabelTokensFromText(stripHtmlTags(task.title))}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {timeLabel && (
          <span className="text-[10px]" style={{ color }}>
            {timeLabel}
          </span>
        )}
        <span
          className="flex items-center gap-0.5 text-[10px]"
          style={{ color: 'var(--color-accent)' }}
        >
          <AlertCircle size={10} />
          {dateLabel}
        </span>
      </div>
    </div>
  )
}

/* ── Habit chip (unscheduled habit in all-day zone) ─────────── */

function HabitChip({
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
        className="group mb-1 flex items-center gap-1.5 overflow-hidden rounded-md px-2 py-1 text-xs font-medium select-none"
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
          className="truncate min-w-0 flex-1"
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
        <span className="ml-auto shrink-0 text-[10px]" style={{ color: `${habit.color}BB` }}>
          {habit.duration_minutes} min
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
            <Pencil size={11} />
          </button>
        )}
      </div>
      {tooltipPortal}
    </>
  )
}

/* ── Timed habit block (scheduled habit on timeline) ────────── */

function TimedHabitBlock({
  habit,
  scheduledTime,
  date,
  completions,
  hourHeight,
  onReschedule,
  onToggle,
  onEdit,
  col = 0,
  totalCols = 1,
}: {
  habit: Habit
  scheduledTime: string
  date: Date
  completions: HabitCompletion[]
  hourHeight: number
  onReschedule: (time: string) => void
  onToggle: () => void
  onEdit?: () => void
  col?: number
  totalCols?: number
}) {
  const completed = isCompletedOnDate(completions, habit.id, date)

  const serverHour = timeStrToHour(scheduledTime)
  const [localHour, setLocalHour] = useState<number | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
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

  // Clear local hour when server data matches
  useEffect(() => {
    if (localHour !== null && Math.abs(serverHour - localHour) < 0.01) setLocalHour(null)
  }, [scheduledTime, serverHour, localHour])

  const currentTop = (baseHour - START_HOUR) * hourHeight + dragOffset
  const currentHeight = Math.max(
    (baseDuration / 60) * hourHeight + resizeDelta,
    (MIN_DURATION / 60) * hourHeight,
  )
  const renderHeight = currentHeight

  const displayHours = pxToHours(currentTop, hourHeight)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const durMin = Math.max(MIN_DURATION, Math.round((currentHeight / hourHeight) * 60))
  const timeStart = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const endHours = displayHours + durMin / 60
  const timeEnd = `${String(Math.floor(endHours) % 24).padStart(2, '0')}:${String(Math.round((endHours % 1) * 60) % 60).padStart(2, '0')}`
  const showTimeSeparate = renderHeight >= 42

  // Drag to move
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
        setDragOffset(delta)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        setInteracting(false)

        if (!didMove.current) {
          onEdit?.()
          return
        }

        setDragOffset((prev) => {
          if (Math.abs(prev) < 4) return 0
          const newHours = pxToHours((baseHour - START_HOUR) * hourHeight + prev, hourHeight)
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
    [baseHour, baseDuration, hourHeight, onReschedule, onEdit],
  )

  // Resize to change duration (global update via parent)
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
            (MIN_DURATION / 60) * hourHeight,
            (baseDuration / 60) * hourHeight + prev,
          )
          const snapped = Math.max(MIN_DURATION, snapMinutes(Math.round((newPx / hourHeight) * 60)))
          setLocalDuration(snapped)
          // Duration is global — caller should update habit.duration_minutes via useUpdateHabit
          // Here we just keep local state; parent handles persistence via onReschedule pattern
          return 0
        })
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseDuration, hourHeight],
  )

  return (
    <>
      <div
        className={cn(
          'group absolute z-10 select-none overflow-hidden rounded-md border-l-3 px-2 py-1',
          completed && 'opacity-50',
          interacting ? 'shadow-lg z-30' : 'cursor-pointer',
        )}
        style={{
          top: currentTop,
          height: renderHeight,
          borderLeftColor: habit.color,
          backgroundColor: `${habit.color}18`,
          transition: interacting ? 'none' : 'top 0.15s ease, height 0.15s ease',
          ...overlapPos(col, totalCols),
        }}
        onMouseDown={handleDragStart}
        {...tooltipHandlers}
      >
        <div className="flex items-start gap-1.5">
          <div className="mt-0.5 shrink-0">
            <HabitCheckbox
              completed={completed}
              color={habit.color}
              onChange={onToggle}
              size="sm"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              {habit.icon && <span className="shrink-0 text-xs">{habit.icon}</span>}
              <p
                className={cn(
                  'truncate text-xs font-medium flex-1 min-w-0',
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
              {!showTimeSeparate && (
                <span
                  className="shrink-0 text-[10px] whitespace-nowrap"
                  style={{ color: `${habit.color}BB` }}
                >
                  {timeStart}
                </span>
              )}
            </div>
            {showTimeSeparate && (
              <p className="text-[10px]" style={{ color: `${habit.color}BB` }}>
                {timeStart}–{timeEnd}
              </p>
            )}
          </div>
        </div>

        {/* Resize handle */}
        <div
          data-resize-handle
          className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
          style={{ height: 8 }}
          onMouseDown={handleResizeStart}
        >
          <div className="h-1 w-8 rounded-full" style={{ backgroundColor: habit.color }} />
        </div>
      </div>
      {tooltipPortal}
    </>
  )
}

/* ── All-day task card ──────────────────────────── */

function TimelineTaskCard({
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

  return (
    <div
      className={cn(
        'mb-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        task.is_completed && 'opacity-50',
      )}
      style={{ backgroundColor: `${color}18` }}
      onClick={() => setSelectedTaskId(task.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TaskCheckbox
        checked={task.is_completed}
        priority={task.priority}
        onChange={(completed) => completeTask.mutate({ id: task.id, completed })}
      />
      <span
        className={cn('truncate text-xs font-medium', task.is_completed && 'line-through')}
        style={{ color: 'var(--text-primary)' }}
      >
        {stripLabelTokensFromText(stripHtmlTags(task.title))}
      </span>
    </div>
  )
}
