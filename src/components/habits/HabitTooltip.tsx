import { useState, useRef, useEffect, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Repeat, Flame, CheckCircle2 } from 'lucide-react'
import { startOfWeek } from 'date-fns'
import {
  isCompletedOnDate,
  calculateStreak,
  getWeeklyProgress,
  getRecurrenceLabel,
} from '@/lib/habitUtils'
import { stripHtmlTags } from '@/lib/utils'
import type { Habit, HabitCompletion } from '@/lib/types'

interface UseHabitTooltipOptions {
  habit: Habit
  completions: HabitCompletion[]
  date: Date
  scheduledTime?: string | null
  disabled?: boolean
}

export function useHabitTooltip({
  habit,
  completions,
  date,
  scheduledTime,
  disabled,
}: UseHabitTooltipOptions) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left, y: rect.top, w: rect.width })
    timerRef.current = setTimeout(() => setShow(true), 400)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setShow(false)
  }

  useEffect(() => {
    if (disabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setShow(false)
    }
  }, [disabled])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!show || !tooltipRef.current) return
    const tt = tooltipRef.current
    const rect = tt.getBoundingClientRect()
    const vh = window.innerHeight

    let left = pos.x - rect.width - 8
    if (left < 8) left = pos.x + pos.w + 8

    let top = pos.y
    if (top + rect.height > vh - 8) top = vh - rect.height - 8
    if (top < 8) top = 8

    tt.style.left = `${left}px`
    tt.style.top = `${top}px`
  }, [show, pos])

  const portal = show
    ? createPortal(
        <HabitTooltipContent
          ref={tooltipRef}
          habit={habit}
          completions={completions}
          date={date}
          scheduledTime={scheduledTime ?? null}
        />,
        document.body,
      )
    : null

  return {
    tooltipHandlers: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    tooltipPortal: portal,
  }
}

/* ── Tooltip content ───────────────────────────────────── */

interface TooltipContentProps {
  habit: Habit
  completions: HabitCompletion[]
  date: Date
  scheduledTime: string | null
}

const HabitTooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ habit, completions, date, scheduledTime }, ref) => {
    const completed = isCompletedOnDate(completions, habit.id, date)
    const streak = calculateStreak(habit, completions, date)
    const recurrenceLabel = getRecurrenceLabel(habit)
    const isTimesPerWeek = habit.recurrence_type === 'times_per_week'

    const weekStart = startOfWeek(date, { weekStartsOn: 1 })
    const weeklyProgress = getWeeklyProgress(completions, habit.id, weekStart)
    const weeklyTarget = habit.times_per_week ?? 1

    const timeLabel = (() => {
      if (!scheduledTime) return `${habit.duration_minutes} min`
      const [h, m] = scheduledTime.split(':').map(Number)
      const totalMin = (h ?? 0) * 60 + (m ?? 0) + habit.duration_minutes
      const eh = Math.floor(totalMin / 60) % 24
      const em = totalMin % 60
      const endStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
      return `${scheduledTime.slice(0, 5)} – ${endStr} · ${habit.duration_minutes} min`
    })()

    return (
      <div
        ref={ref}
        className="pointer-events-none fixed z-[100] w-56 rounded-xl border p-3 shadow-2xl animate-fade-in"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          borderLeftWidth: 3,
          borderLeftColor: habit.color,
          left: -9999,
          top: -9999,
        }}
      >
        {/* Header badge */}
        <div className="mb-2 flex items-center gap-1.5">
          <div
            className="flex h-5 w-5 items-center justify-center rounded"
            style={{ backgroundColor: `${habit.color}25`, color: habit.color }}
          >
            <Repeat size={11} />
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: habit.color }}
          >
            Hábito
          </span>
        </div>

        {/* Title */}
        <div className="flex items-center gap-2">
          {habit.icon && <span className="text-base leading-none">{habit.icon}</span>}
          <p
            className="text-sm font-semibold leading-snug"
            style={{
              color: 'var(--text-primary)',
              textDecoration: completed ? 'line-through' : 'none',
              opacity: completed ? 0.7 : 1,
            }}
          >
            {stripHtmlTags(habit.name)}
          </p>
        </div>

        <div className="mt-2.5 space-y-1.5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <CheckCircle2
              size={13}
              className="flex-shrink-0"
              style={{ color: completed ? '#22C55E' : 'var(--text-muted)' }}
            />
            <span className="text-xs" style={{ color: completed ? '#22C55E' : 'var(--text-muted)' }}>
              {completed ? 'Completado hoy' : 'Pendiente hoy'}
            </span>
          </div>

          {/* Time / Duration */}
          <div className="flex items-center gap-2">
            <Clock size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {timeLabel}
            </span>
          </div>

          {/* Recurrence */}
          <div className="flex items-center gap-2">
            <Repeat size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {recurrenceLabel}
            </span>
          </div>

          {/* Streak */}
          {streak.current > 0 && (
            <div className="flex items-center gap-2">
              <Flame size={13} className="flex-shrink-0" style={{ color: '#F59E0B' }} />
              <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                {streak.current} {streak.current === 1 ? 'día seguido' : 'días seguidos'}
              </span>
            </div>
          )}

          {/* Weekly progress */}
          {isTimesPerWeek && (
            <div className="mt-1 flex items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor:
                    weeklyProgress.done >= weeklyTarget
                      ? `${habit.color}20`
                      : 'var(--bg-secondary)',
                  color:
                    weeklyProgress.done >= weeklyTarget ? habit.color : 'var(--text-secondary)',
                }}
              >
                {weeklyProgress.done}/{weeklyTarget} esta semana
              </span>
            </div>
          )}
        </div>
      </div>
    )
  },
)
HabitTooltipContent.displayName = 'HabitTooltipContent'
