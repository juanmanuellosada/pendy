import { Flame, Clock } from 'lucide-react'
import { startOfWeek } from 'date-fns'
import { HabitCheckbox } from './HabitCheckbox'
import { useHabitTooltip } from './HabitTooltip'
import {
  isCompletedOnDate,
  calculateStreak,
  getWeeklyProgress,
  getRecurrenceLabel,
  getScheduledTimeForDate,
} from '@/lib/habitUtils'
import { stripLabelTokensFromHtml } from '@/lib/utils'
import type { Habit, HabitCompletion, HabitSchedule } from '@/lib/types'

interface HabitItemProps {
  habit: Habit
  completions: HabitCompletion[]
  schedules?: HabitSchedule[]
  date: Date
  onToggle: (habitId: string, date: Date) => void
  onEdit?: () => void
  isPending?: boolean
}

export function HabitItem({
  habit,
  completions,
  schedules = [],
  date,
  onToggle,
  onEdit,
  isPending,
}: HabitItemProps) {
  const completed = isCompletedOnDate(completions, habit.id, date)
  const streak = calculateStreak(habit, completions, date)

  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weeklyProgress = getWeeklyProgress(completions, habit.id, weekStart)
  const weeklyTarget = habit.times_per_week ?? 1

  const isTimesPerWeek = habit.recurrence_type === 'times_per_week'
  const recurrenceLabel = getRecurrenceLabel(habit)

  const scheduledTime = getScheduledTimeForDate(habit, schedules, date)
  const timeLabel = scheduledTime
    ? `${scheduledTime.slice(0, 5)} · ${habit.duration_minutes} min`
    : `${habit.duration_minutes} min`

  const { tooltipHandlers, tooltipPortal } = useHabitTooltip({
    habit,
    completions,
    date,
    scheduledTime,
  })

  return (
    <>
      <div
        className="relative flex items-center gap-3 px-3 py-2.5 transition-colors"
        style={{
          borderLeft: `3px solid ${habit.color}`,
          backgroundColor: completed ? `${habit.color}0A` : `${habit.color}06`,
          cursor: onEdit ? 'pointer' : 'default',
        }}
        onClick={onEdit}
        {...tooltipHandlers}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <HabitCheckbox
            completed={completed}
            color={habit.color}
            onChange={() => onToggle(habit.id, date)}
            disabled={isPending}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            {habit.icon && <span className="text-base leading-none">{habit.icon}</span>}
            <span
              className="truncate text-sm font-medium min-w-0"
              style={{
                color: 'var(--text-primary)',
                textDecoration: completed ? 'line-through' : 'none',
                opacity: completed ? 0.6 : 1,
              }}
              dangerouslySetInnerHTML={{
                __html: stripLabelTokensFromHtml(habit.name).replace(/^<p>(.*)<\/p>$/, '$1'),
              }}
            />
            <span
              className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
            >
              Hábito
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {recurrenceLabel}
            </span>

            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              <Clock size={10} />
              {timeLabel}
            </span>
          </div>
        </div>

        {/* Streak or weekly progress badge */}
        {isTimesPerWeek ? (
          <div
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor:
                weeklyProgress.done >= weeklyTarget ? `${habit.color}20` : 'var(--bg-secondary)',
              color: weeklyProgress.done >= weeklyTarget ? habit.color : 'var(--text-secondary)',
            }}
          >
            {weeklyProgress.done}/{weeklyTarget} sem.
          </div>
        ) : streak.current > 1 ? (
          <div
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}
          >
            <Flame size={11} />
            {streak.current}
          </div>
        ) : null}
      </div>
      {tooltipPortal}
    </>
  )
}
