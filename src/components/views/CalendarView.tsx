import { useState, useRef, useMemo } from 'react'
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
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useCalendarTasks, useUpdateTask } from '@/hooks/useTasks'
import { PRIORITY_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'
import type { CalendarMode } from '@/stores/uiStore'

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface CalendarViewProps {
  calendarMode: CalendarMode
  onAddTask: (dateStr: string) => void
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

  // Range of days to display
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

  const fromStr = days.length > 0 ? format(days[0], 'yyyy-MM-dd') : ''
  const toStr = days.length > 0 ? format(days[days.length - 1], 'yyyy-MM-dd') : ''
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
    // Only clear if leaving the cell entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverDate(null)
    }
  }

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault()
    if (draggedTaskId.current) {
      updateTask.mutate({ id: draggedTaskId.current, updates: { due_date: dateStr } })
      draggedTaskId.current = null
    }
    setDragOverDate(null)
  }

  const isMonthView = calendarMode === 'month' || !calendarMode
  // Para el header: mes siempre 7 columnas; otros modos = cantidad de días
  const headerCols = isMonthView ? 7 : days.length
  const cols = days.length

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

        <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
          {periodLabel}
        </span>
      </div>

      {/* Calendar container */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {/* Day-of-week header */}
        <div
          className="grid border-b"
          style={{
            gridTemplateColumns: `repeat(${headerCols}, 1fr)`,
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          {isMonthView
            ? WEEK_DAYS.map((name) => (
                <div
                  key={name}
                  className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {name}
                </div>
              ))
            : days.map((day, i) => (
                <div
                  key={i}
                  className="py-2.5 text-center"
                  style={{
                    borderRight: i < days.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {format(day, 'EEE', { locale: es })}
                  </p>
                  <div
                    className={cn(
                      'mx-auto mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold',
                    )}
                    style={{
                      backgroundColor: isToday(day) ? '#283B56' : 'transparent',
                      color: isToday(day) ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {format(day, 'd')}
                  </div>
                </div>
              ))}
        </div>

        {/* Grid body */}
        {isMonthView ? (
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
                    <DayCell
                      key={colIdx}
                      day={day}
                      dateStr={dateStr}
                      tasks={tasksForDay(day)}
                      isToday={isToday(day)}
                      inCurrentMonth={isSameMonth(day, currentDate)}
                      isOver={dragOverDate === dateStr}
                      isMonthView
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
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {days.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              return (
                <DayCell
                  key={i}
                  day={day}
                  dateStr={dateStr}
                  tasks={tasksForDay(day)}
                  isToday={isToday(day)}
                  inCurrentMonth
                  isOver={dragOverDate === dateStr}
                  isMonthView={false}
                  hasRightBorder={i < days.length - 1}
                  onAddTask={onAddTask}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Day Cell ──────────────────────────────────────────── */

interface DayCellProps {
  day: Date
  dateStr: string
  tasks: Task[]
  isToday: boolean
  inCurrentMonth: boolean
  isOver: boolean
  isMonthView: boolean
  hasRightBorder: boolean
  onAddTask: (dateStr: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragOver: (e: React.DragEvent, dateStr: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, dateStr: string) => void
}

function DayCell({
  day,
  dateStr,
  tasks,
  isToday: today,
  inCurrentMonth,
  isOver,
  isMonthView,
  hasRightBorder,
  onAddTask,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: DayCellProps) {
  const [hovered, setHovered] = useState(false)
  const maxVisible = isMonthView ? 3 : 999
  const visible = tasks.slice(0, maxVisible)
  const overflow = tasks.length - maxVisible

  return (
    <div
      className={cn(
        'relative flex flex-col p-1.5 transition-colors select-none',
        isMonthView ? 'min-h-[108px]' : 'min-h-[220px]',
      )}
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
      {/* Day number + add button */}
      <div className="mb-1.5 flex items-center justify-between">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{
            backgroundColor: today ? '#283B56' : 'transparent',
            color: today ? '#fff' : inCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
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

      {/* Task chips */}
      <div className="flex flex-col gap-0.5">
        {visible.map((task) => (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs cursor-grab active:cursor-grabbing truncate transition-opacity hover:opacity-80"
            style={{
              backgroundColor: PRIORITY_COLORS[task.priority] + '20',
            }}
            title={task.title}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            />
            <span
              className={cn('truncate', task.is_completed && 'line-through opacity-50')}
              style={{ color: 'var(--text-primary)' }}
            >
              {task.title}
            </span>
          </div>
        ))}
        {overflow > 0 && (
          <p
            className="px-1.5 text-xs font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            +{overflow} más
          </p>
        )}
      </div>
    </div>
  )
}
