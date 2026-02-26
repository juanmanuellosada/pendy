import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
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
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCalendarTasks, useUpdateTask, useCompleteTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useAppStore } from '@/stores/appStore'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { PRIORITY_COLORS } from '@/lib/constants'
import { cn, stripHtmlTags, stripLabelTokensFromText } from '@/lib/utils'
import type { Task } from '@/lib/types'
import { TaskTooltip } from '@/components/common/TaskTooltip'
import type { CalendarMode } from '@/stores/uiStore'

const HOUR_HEIGHT = 56
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const SNAP_MINUTES = 15
const MIN_DURATION = 15

interface CalendarViewProps {
  calendarMode: CalendarMode
  onAddTask: (dateStr: string) => void
}

function pxToHours(px: number): number {
  return START_HOUR + px / HOUR_HEIGHT
}

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function CalendarView({ calendarMode, onAddTask }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const updateTask = useUpdateTask()
  const draggedTaskId = useRef<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  const days = useMemo((): Date[] => {
    switch (calendarMode) {
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
  }, [calendarMode, currentDate])

  const fromStr = days.length > 0 ? format(days[0]!, 'yyyy-MM-dd') : ''
  const toStr = days.length > 0 ? format(days[days.length - 1]!, 'yyyy-MM-dd') : ''
  const { data: tasks = [] } = useCalendarTasks(fromStr, toStr)

  const navigate = (dir: 1 | -1) => {
    setCurrentDate((prev) => {
      switch (calendarMode) {
        case 'week': return dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1)
        case '4days': return dir === 1 ? addDays(prev, 4) : subDays(prev, 4)
        case 'day': return dir === 1 ? addDays(prev, 1) : subDays(prev, 1)
        case 'month':
        default: return dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1)
      }
    })
  }

  const periodLabel = useMemo(() => {
    switch (calendarMode) {
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
  }, [calendarMode, currentDate])

  const isTimelineMode = calendarMode === 'week' || calendarMode === '4days' || calendarMode === 'day'
  const isMonthView = calendarMode === 'month'

  /* ── Drag for month grid ── */
  const tasksForDay = (date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return tasks.filter((t) => t.due_date === dateStr)
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
          <button onClick={() => navigate(-1)} className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} aria-label="Anterior"><ChevronLeft size={16} /></button>
          <button onClick={() => navigate(1)} className="rounded-lg p-1.5 transition-colors" style={{ color: 'var(--text-secondary)' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')} aria-label="Siguiente"><ChevronRight size={16} /></button>
        </div>
        <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>{periodLabel}</span>
      </div>

      {/* ── Timeline mode (week / 4days / day) ── */}
      {isTimelineMode && (
        <TimelineGrid
          days={days}
          tasks={tasks}
          onAddTask={onAddTask}
          onNavigate={navigate}
        />
      )}

      {/* ── Month grid ── */}
      {isMonthView && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="grid border-b" style={{ gridTemplateColumns: `repeat(${headerCols}, 1fr)`, borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
            {WEEK_DAYS.map((name) => (
              <div key={name} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{name}</div>
            ))}
          </div>
          <div>
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, rowIdx) => (
              <div key={rowIdx} className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: rowIdx < Math.ceil(days.length / 7) - 1 ? '1px solid var(--border-secondary)' : 'none' }}>
                {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                  const dateStr = format(day, 'yyyy-MM-dd')
                  return (
                    <MonthDayCell
                      key={colIdx}
                      day={day}
                      dateStr={dateStr}
                      tasks={tasksForDay(day)}
                      isTodayDate={isToday(day)}
                      inCurrentMonth={isSameMonth(day, currentDate)}
                      isOver={dragOverDate === dateStr}
                      hasRightBorder={colIdx < 6}
                      onAddTask={onAddTask}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
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

function TimelineGrid({
  days,
  tasks,
  onAddTask,
  onNavigate,
}: {
  days: Date[]
  tasks: Task[]
  onAddTask: (dateStr: string) => void
  onNavigate?: (dir: 1 | -1) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const updateTask = useUpdateTask()
  const { setSelectedTaskId } = useAppStore()

  const [now, setNow] = useState(new Date())
  const [highlightCol, setHighlightCol] = useState<number | null>(null)

  // Drag managed at grid level
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })
  const [ghostOffset, setGhostOffset] = useState({ dx: 0, dy: 0 })
  const [didMove, setDidMove] = useState(false)
  const didMoveRef = useRef(false)
  const edgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [currentDragCol, setCurrentDragCol] = useState(-1)
  const [localHourHints, setLocalHourHints] = useState<Record<string, number>>({})

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
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const dayTasks = tasks.filter((t) => t.due_date === dateStr)
      const allDay = dayTasks.filter((t) => !t.has_time || !t.due_datetime)
      const timed = dayTasks.filter((t) => t.has_time && t.due_datetime)
      return { day, dateStr, allDay, timed }
    })
  }, [days, tasks])

  const hasAnyAllDay = dayData.some((d) => d.allDay.length > 0)

  const getColFromX = useCallback((clientX: number): number => {
    if (!gridRef.current) return -1
    const rect = gridRef.current.getBoundingClientRect()
    const hourLabelWidth = 56
    const colAreaLeft = rect.left + hourLabelWidth
    const colAreaWidth = rect.width - hourLabelWidth
    const colWidth = colAreaWidth / days.length
    return Math.floor((clientX - colAreaLeft) / colWidth)
  }, [days.length])

  const getHourFromY = useCallback((clientY: number): number => {
    if (!gridRef.current) return 0
    const rect = gridRef.current.getBoundingClientRect()
    const py = clientY - rect.top + (containerRef.current?.scrollTop ?? 0)
    return pxToHours(py)
  }, [])

  /* ── Start drag (called by task blocks) ── */
  const handleTaskDragStart = useCallback((task: Task, e: React.MouseEvent) => {
    const dt = new Date(task.due_datetime!)
    const hour = dt.getHours() + dt.getMinutes() / 60
    const col = getColFromX(e.clientX)
    setDidMove(false)
    didMoveRef.current = false

    setDrag({
      taskId: task.id,
      task,
      startX: e.clientX,
      startY: e.clientY,
      baseHour: hour,
      baseDuration: task.duration_minutes || 60,
      originCol: col,
    })
    setGhostPos({ x: e.clientX, y: e.clientY })
    setGhostOffset({ dx: 0, dy: 0 })
  }, [getColFromX])

  /* ── Drag move & drop (document listeners) ── */
  useEffect(() => {
    if (!drag) return

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - drag.startX
      const dy = ev.clientY - drag.startY
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didMoveRef.current = true
        setDidMove(true)
      }
      setGhostPos({ x: ev.clientX, y: ev.clientY })
      setGhostOffset({ dx, dy })

      const col = getColFromX(ev.clientX)
      setCurrentDragCol(col)
      if (col >= 0 && col < days.length) {
        setHighlightCol(col === drag.originCol ? null : col)
        if (edgeTimer.current) { clearTimeout(edgeTimer.current); edgeTimer.current = null }
      } else {
        setHighlightCol(null)
        // Auto-navigate on edge after 350ms
        if (!edgeTimer.current && onNavigate) {
          const dir = col < 0 ? -1 : 1
          edgeTimer.current = setTimeout(() => {
            // Update task date to the edge day and navigate
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
            // After edge navigation, update drag state so:
            // - originCol is impossible to match → ghost always shows (no stale same-col detection)
            // - task.due_date reflects the new date → sameDayAndTime check works correctly
            // - baseHour reflects the new time
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
      if (edgeTimer.current) { clearTimeout(edgeTimer.current); edgeTimer.current = null }
      setHighlightCol(null)
      setCurrentDragCol(-1)

      const col = getColFromX(ev.clientX)
      const moved = didMoveRef.current

      if (moved) {
        const clampedCol = Math.max(0, Math.min(col, days.length - 1))
        const targetDay = days[clampedCol]
        if (targetDay) {
          // Same column: compute from drag offset for accurate block-relative positioning
          // Cross column: compute from absolute mouse Y position
          const isSameCol = clampedCol === drag.originCol
          const rawHour = isSameCol
            ? pxToHours((drag.baseHour - START_HOUR) * HOUR_HEIGHT + (ev.clientY - drag.startY))
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
        setSelectedTaskId(drag.taskId)
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

  // Cleanup edge timer on unmount
  useEffect(() => () => { if (edgeTimer.current) clearTimeout(edgeTimer.current) }, [])

  // Whether the currently dragged task is in the same column (smooth vertical movement)
  const isDragSameCol = !!(drag && didMove && currentDragCol >= 0 && currentDragCol === drag.originCol)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
      {/* Day headers */}
      <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
        <div />
        {days.map((day, i) => (
          <div key={i} className="py-2 text-center" style={{ borderLeft: '1px solid var(--border-secondary)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{format(day, 'EEE', { locale: es })}</p>
            <div className="mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: isToday(day) ? '#283B56' : 'transparent', color: isToday(day) ? '#fff' : 'var(--text-primary)' }}>{format(day, 'd')}</div>
          </div>
        ))}
      </div>

      {/* All-day row */}
      {hasAnyAllDay && (
        <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, borderColor: 'var(--border-secondary)' }}>
          <div className="flex items-start justify-end pr-2 pt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>Todo el día</div>
          {dayData.map((dd, i) => (
            <div key={i} className="min-h-[32px] border-l p-1" style={{ borderColor: 'var(--border-secondary)' }}>
              {dd.allDay.map((t) => <TaskTooltip key={t.id} task={t}><AllDayChip task={t} /></TaskTooltip>)}
            </div>
          ))}
        </div>
      )}

      {/* Timeline body */}
      <div ref={containerRef} className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        <div ref={gridRef} className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          {/* Hour labels */}
          <div>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div key={i} className="relative pr-2 text-right text-[11px]" style={{ height: HOUR_HEIGHT, color: 'var(--text-muted)' }}>
                <span className="relative -top-2">{`${(START_HOUR + i).toString().padStart(2, '0')}:00`}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {dayData.map((dd, colIdx) => (
            <div
              key={colIdx}
              className="relative border-l transition-colors duration-150"
              style={{ borderColor: 'var(--border-secondary)', backgroundColor: highlightCol === colIdx ? 'var(--bg-hover)' : 'transparent' }}
            >
              {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                <div key={i} className="border-t" style={{ height: HOUR_HEIGHT, borderColor: 'var(--border-secondary)' }} />
              ))}

              {dd.timed.map((task) => (
                <TaskTooltip key={task.id} task={task} disabled={!!drag}>
                  <TimelineTaskBlock
                    task={task}
                    isDragging={!!(drag?.taskId === task.id && didMove && !isDragSameCol)}
                    activeDragDy={drag?.taskId === task.id && isDragSameCol ? ghostOffset.dy : 0}
                    localHourHint={localHourHints[task.id]}
                    onDragStart={handleTaskDragStart}
                  />
                </TaskTooltip>
              ))}

              {colIdx === todayIdx && (
                <div ref={nowLineRef} className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
                  <div className="h-2.5 w-2.5 -ml-[5px] rounded-full" style={{ backgroundColor: '#EC1E2A' }} />
                  <div className="flex-1 border-t-2" style={{ borderColor: '#EC1E2A' }} />
                </div>
              )}
            </div>
          ))}

          {todayIdx >= 0 && (
            <div className="pointer-events-none absolute left-0 z-20" style={{ top: nowTop - 7, width: 56 }}>
              <span className="block text-right pr-2 text-[10px] font-semibold" style={{ color: '#EC1E2A' }}>{nowLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Drag ghost (fixed overlay following cursor, only for cross-column drag) */}
      {drag && didMove && !isDragSameCol && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border-l-3 px-1.5 py-0.5 shadow-xl opacity-80"
          style={{
            left: ghostPos.x - 60,
            top: ghostPos.y - 14,
            width: 140,
            height: Math.max((drag.baseDuration / 60) * HOUR_HEIGHT, (MIN_DURATION / 60) * HOUR_HEIGHT),
            borderLeftColor: PRIORITY_COLORS[drag.task.priority] ?? PRIORITY_COLORS[4],
            backgroundColor: (PRIORITY_COLORS[drag.task.priority] ?? PRIORITY_COLORS[4]) + '30',
          }}
        >
          <p className="truncate text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
            {stripHtmlTags(drag.task.title)}
          </p>
        </div>
      )}
    </div>
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
}: {
  task: Task
  isDragging: boolean
  activeDragDy?: number
  localHourHint?: number
  onDragStart: (task: Task, e: React.MouseEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
}) {
  const updateTask = useUpdateTask()
  const completeTask = useCompleteTask()
  const { data: projects } = useProjects()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]

  const dt = new Date(task.due_datetime!)
  const serverHour = dt.getHours() + dt.getMinutes() / 60
  const duration = task.duration_minutes || 60

  // Use local hour hint for optimistic positioning after same-column drop
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

  // Compute display times from current visual position (updates in real-time during drag)
  const displayHours = pxToHours(Math.max(0, currentTop))
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

  // Progressive thresholds (px)
  const showTimeSeparate = currentHeight >= 38
  const showDescription = currentHeight >= 60 && description
  const showProject = currentHeight >= 78 && project
  const showLabels = currentHeight >= 96 && labels.length > 0

  const isSameColDrag = activeDragDy !== 0

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
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
          const snapped = Math.max(MIN_DURATION, snapMinutes(Math.round((newPx / HOUR_HEIGHT) * 60)))
          updateTask.mutate({ id: task.id, updates: { duration_minutes: snapped } })
          return 0
        })
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [baseHeight, task.id, updateTask],
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
        'group absolute left-0.5 right-0.5 z-10 select-none overflow-hidden rounded-md border-l-3 px-1.5 py-0.5',
        task.is_completed && 'opacity-50',
        isDragging && 'opacity-30',
        isSameColDrag ? 'shadow-lg z-30' : resizing ? 'shadow-lg z-30' : 'cursor-pointer',
      )}
      style={{
        top: currentTop,
        height: currentHeight,
        borderLeftColor: color,
        backgroundColor: `${color}18`,
        transition: isSameColDrag || isDragging || resizing ? 'none' : 'top 0.15s ease, height 0.15s ease',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-start gap-1">
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
            <p className={cn('truncate text-[11px] font-medium flex-1 min-w-0', task.is_completed && 'line-through')} style={{ color: 'var(--text-primary)' }}>{stripLabelTokensFromText(stripHtmlTags(task.title))}</p>
            {!showTimeSeparate && (
              <span className="shrink-0 text-[10px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
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
            <p className="truncate text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>
          )}
          {/* Project */}
          {showProject && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-block h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              <span className="truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{project.name}</span>
            </div>
          )}
          {/* Labels */}
          {showLabels && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {labels.slice(0, 2).map((label) => (
                <span key={label.id} className="rounded px-1 py-px text-[9px] font-medium" style={{ backgroundColor: label.color + '20', color: label.color }}>{label.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div data-resize-handle className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100" style={{ height: 7 }} onMouseDown={handleResizeStart}>
        <div className="h-0.5 w-6 rounded-full" style={{ backgroundColor: color }} />
      </div>
    </div>
  )
}

/* ── All-day chip ──────────────────────────────────────── */

function AllDayChip({ task, onMouseEnter, onMouseLeave }: { task: Task; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: (e: React.MouseEvent) => void }) {
  const completeTask = useCompleteTask()
  const { setSelectedTaskId } = useAppStore()
  const color = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[4]

  return (
    <div
      className={cn(
        'mb-0.5 flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[11px] truncate',
        task.is_completed && 'opacity-50',
      )}
      style={{ backgroundColor: `${color}20` }}
      onClick={() => setSelectedTaskId(task.id)}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <TaskCheckbox
        checked={task.is_completed}
        priority={task.priority}
        onChange={(completed) => completeTask.mutate({ id: task.id, completed })}
      />
      <span className={cn('truncate', task.is_completed && 'line-through')} style={{ color: 'var(--text-primary)' }}>
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
  isTodayDate: boolean
  inCurrentMonth: boolean
  isOver: boolean
  hasRightBorder: boolean
  onAddTask: (dateStr: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragOver: (e: React.DragEvent, dateStr: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, dateStr: string) => void
}

function MonthDayCell({
  day,
  dateStr,
  tasks,
  isTodayDate,
  inCurrentMonth,
  isOver,
  hasRightBorder,
  onAddTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: MonthDayCellProps) {
  const [hovered, setHovered] = useState(false)
  const maxVisible = 3
  const visible = tasks.slice(0, maxVisible)
  const overflow = tasks.length - maxVisible

  return (
    <div
      className="relative flex flex-col p-1.5 transition-colors select-none min-h-[108px]"
      style={{
        borderRight: hasRightBorder ? '1px solid var(--border-secondary)' : 'none',
        backgroundColor: isOver ? 'var(--bg-active)' : !inCurrentMonth ? 'var(--bg-secondary)' : 'transparent',
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
            backgroundColor: isTodayDate ? '#283B56' : 'transparent',
            color: isTodayDate ? '#fff' : inCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        >
          {format(day, 'd')}
        </div>
        {hovered && (
          <button
            onClick={() => onAddTask(dateStr)}
            className="rounded-full p-0.5 transition-opacity hover:opacity-60"
            style={{ color: 'var(--text-muted)' }}
            title={`Agregar tarea para el ${dateStr}`}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {visible.map((task) => (
          <TaskTooltip key={task.id} task={task}>
            <div
              draggable
              onDragStart={(e) => onDragStart(e, task.id)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs cursor-grab active:cursor-grabbing truncate transition-opacity hover:opacity-80"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] + '20' }}
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
              <span className={cn('truncate', task.is_completed && 'line-through opacity-50')} style={{ color: 'var(--text-primary)' }}>
                {stripLabelTokensFromText(stripHtmlTags(task.title))}
              </span>
            </div>
          </TaskTooltip>
        ))}
        {overflow > 0 && (
          <p className="px-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>+{overflow} más</p>
        )}
      </div>
    </div>
  )
}
