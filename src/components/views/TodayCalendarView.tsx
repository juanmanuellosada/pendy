import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { useCompleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useAppStore } from '@/stores/appStore'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { PRIORITY_COLORS } from '@/lib/constants'
import { cn, stripHtmlTags, stripLabelTokensFromText } from '@/lib/utils'
import { TaskTooltip } from '@/components/common/TaskTooltip'
import type { Task, Label } from '@/lib/types'

const HOUR_HEIGHT = 64 // px per hour
const START_HOUR = 0
const END_HOUR = 24
const TOTAL_HOURS = END_HOUR - START_HOUR
const SNAP_MINUTES = 15 // snap to 15-min increments
const MIN_DURATION = 15 // minimum 15 minutes

interface TodayCalendarViewProps {
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
}

/** Convert a pixel offset (relative to grid top) to fractional hours */
function pxToHours(px: number): number {
  return START_HOUR + px / HOUR_HEIGHT
}

/** Snap minutes to nearest SNAP_MINUTES */
function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES
}

export function TodayCalendarView({ tasks, labelsMap }: TodayCalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const nowLineRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(new Date())

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

  // Split tasks: all-day (no time) vs timed
  const { allDayTasks, timedTasks } = useMemo(() => {
    const allDay: Task[] = []
    const timed: Task[] = []
    tasks.forEach((t) => {
      if (t.has_time && t.due_datetime) {
        timed.push(t)
      } else {
        allDay.push(t)
      }
    })
    return { allDayTasks: allDay, timedTasks: timed }
  }, [tasks])

  // Current time position
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowTop = (nowHour - START_HOUR) * HOUR_HEIGHT
  const nowLabel = format(now, 'HH:mm')

  return (
    <div className="flex flex-col">
      {/* All-day section */}
      {allDayTasks.length > 0 && (
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
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div
        ref={containerRef}
        className="relative flex overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 200px)' }}
      >
        {/* Hour labels */}
        <div className="w-14 shrink-0">
          {Array.from({ length: TOTAL_HOURS }, (_, i) => {
            const hour = START_HOUR + i
            return (
              <div
                key={hour}
                className="relative pr-2 text-right text-xs"
                style={{ height: HOUR_HEIGHT, color: 'var(--text-muted)' }}
              >
                <span className="relative -top-2">
                  {`${hour.toString().padStart(2, '0')}:00`}
                </span>
              </div>
            )
          })}
        </div>

        {/* Grid + events */}
        <div ref={gridRef} className="relative flex-1">
          {/* Hour lines */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <div
              key={i}
              className="border-t"
              style={{ height: HOUR_HEIGHT, borderColor: 'var(--border-secondary)' }}
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
              style={{ backgroundColor: '#EC1E2A' }}
            />
            <div className="flex-1 border-t-2" style={{ borderColor: '#EC1E2A' }} />
            <span
              className="ml-1 text-[10px] font-semibold"
              style={{ color: '#EC1E2A' }}
            >
              {nowLabel}
            </span>
          </div>

          {/* Timed tasks */}
          {timedTasks.map((task) => (
            <TaskTooltip key={task.id} task={task}>
              <TimedTaskBlock task={task} gridRef={gridRef} />
            </TaskTooltip>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Timed task block (draggable + resizable) ────────── */

function TimedTaskBlock({
  task,
  gridRef,
  onMouseEnter,
  onMouseLeave,
}: {
  task: Task
  gridRef: React.RefObject<HTMLDivElement | null>
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
}) {
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

  // Computed display times
  const displayHours = pxToHours(currentTop)
  const displayH = Math.floor(displayHours)
  const displayM = Math.round((displayHours - displayH) * 60)
  const displayDurationMin = Math.max(
    MIN_DURATION,
    Math.round((currentHeight / HOUR_HEIGHT) * 60),
  )
  const endHours = displayHours + displayDurationMin / 60
  const endH = Math.floor(endHours)
  const endM = Math.round((endHours - endH) * 60)

  const timeStart = `${String(displayH).padStart(2, '0')}:${String(displayM).padStart(2, '0')}`
  const timeEnd = `${String(Math.min(endH, 23)).padStart(2, '0')}:${String(endM % 60).padStart(2, '0')}`
  const timeStr = `${timeStart}–${timeEnd}`

  const project = projects?.find((p) => p.id === task.project_id)
  const labels = labelsMap?.get(task.id) ?? []
  const description = task.description ? stripHtmlTags(task.description).trim() : ''

  // Progressive thresholds (px) — HOUR_HEIGHT=64
  const showTimeSeparate = currentHeight >= 42
  const showDescription = currentHeight >= 64 && description
  const showProject = currentHeight >= 84 && project
  const showLabels = currentHeight >= 104 && labels.length > 0

  /* ── Drag to move ── */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
      if ((e.target as HTMLElement).closest('button')) return

      e.preventDefault()
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

          const newHours = pxToHours((baseHour - START_HOUR) * HOUR_HEIGHT + prev)
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
        'group absolute left-1 right-2 z-10 select-none overflow-hidden rounded-md border-l-3 px-2 py-1',
        task.is_completed && 'opacity-50',
        interacting ? 'shadow-lg z-30' : 'cursor-pointer',
      )}
      style={{
        top: currentTop,
        height: currentHeight,
        borderLeftColor: color,
        backgroundColor: `${color}18`,
        transition: interacting ? 'none' : 'top 0.15s ease, height 0.15s ease',
      }}
      onMouseDown={handleDragStart}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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
            <p className={cn('truncate text-xs font-medium flex-1 min-w-0', task.is_completed && 'line-through')} style={{ color: 'var(--text-primary)' }}>
              {stripLabelTokensFromText(stripHtmlTags(task.title))}
            </p>
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

      {/* Resize handle at the bottom */}
      <div
        data-resize-handle
        className="absolute bottom-0 left-0 right-0 flex cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
        style={{ height: 8 }}
        onMouseDown={handleResizeStart}
      >
        <div
          className="h-1 w-8 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}

/* ── All-day task card ──────────────────────────── */

function TimelineTaskCard({ task, onMouseEnter, onMouseLeave }: { task: Task; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: (e: React.MouseEvent) => void }) {
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
        className={cn(
          'truncate text-xs font-medium',
          task.is_completed && 'line-through',
        )}
        style={{ color: 'var(--text-primary)' }}
      >
        {stripLabelTokensFromText(stripHtmlTags(task.title))}
      </span>
    </div>
  )
}
