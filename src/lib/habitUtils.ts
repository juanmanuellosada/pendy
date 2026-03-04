import {
  getDay,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWithinInterval,
  subDays,
  format,
} from 'date-fns'
import type { Habit, HabitCompletion, HabitSchedule } from './types'

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Returns true if the habit should appear on the given date */
export function habitAppearsOnDate(habit: Habit, date: Date): boolean {
  if (!habit.is_active || habit.is_archived) return false

  // Don't show habit on dates before it was created
  const createdDay = new Date(habit.created_at)
  createdDay.setHours(0, 0, 0, 0)
  const checkDay = new Date(date)
  checkDay.setHours(0, 0, 0, 0)
  if (checkDay < createdDay) return false

  switch (habit.recurrence_type) {
    case 'daily':
      return true
    case 'specific_days':
      return habit.specific_days.includes(getDay(date))
    case 'times_per_week':
      return true // show every day, display weekly progress
  }
}

/** Returns true if the habit was completed on the given date */
export function isCompletedOnDate(
  completions: HabitCompletion[],
  habitId: string,
  date: Date,
): boolean {
  const dateStr = format(date, 'yyyy-MM-dd')
  return completions.some((c) => c.habit_id === habitId && c.completed_date === dateStr)
}

/** Returns weekly progress (done/target) for a times_per_week habit */
export function getWeeklyProgress(
  completions: HabitCompletion[],
  habitId: string,
  weekStart: Date,
): { done: number; target: number } {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  const done = completions.filter((c) => {
    if (c.habit_id !== habitId) return false
    const d = new Date(c.completed_date + 'T00:00:00')
    return isWithinInterval(d, { start: weekStart, end: weekEnd })
  }).length
  return { done, target: 0 } // target filled in by caller
}

/** Calculates current and best streak for a habit */
export function calculateStreak(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date,
): { current: number; best: number } {
  const habitCompletions = completions.filter((c) => c.habit_id === habit.id)

  if (habit.recurrence_type === 'daily') {
    return calcDailyStreak(habitCompletions, today)
  } else if (habit.recurrence_type === 'specific_days') {
    return calcSpecificDaysStreak(habit, habitCompletions, today)
  } else {
    return calcWeeklyStreak(habit, habitCompletions, today)
  }
}

function calcDailyStreak(
  completions: HabitCompletion[],
  today: Date,
): { current: number; best: number } {
  const completedDates = new Set(completions.map((c) => c.completed_date))

  // Current streak: count backwards from today
  let current = 0
  let d = today
  while (completedDates.has(format(d, 'yyyy-MM-dd'))) {
    current++
    d = subDays(d, 1)
  }

  // Best streak: iterate all dates
  const sorted = Array.from(completedDates).sort()
  let best = 0
  let run = 0
  let prev: string | null = null

  for (const dateStr of sorted) {
    if (prev) {
      const prevDate = new Date(prev + 'T00:00:00')
      const currDate = new Date(dateStr + 'T00:00:00')
      const diff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      run = diff === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    if (run > best) best = run
    prev = dateStr
  }

  return { current, best }
}

function calcSpecificDaysStreak(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date,
): { current: number; best: number } {
  const completedDates = new Set(completions.map((c) => c.completed_date))

  // Current streak: walk backwards counting required days
  let current = 0
  let d = today
  let maxLookback = 365

  while (maxLookback-- > 0) {
    if (habit.specific_days.includes(getDay(d))) {
      if (completedDates.has(format(d, 'yyyy-MM-dd'))) {
        current++
      } else {
        // Allow skipping today if not yet reached end of day
        if (format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && current === 0) {
          d = subDays(d, 1)
          continue
        }
        break
      }
    }
    d = subDays(d, 1)
  }

  // Best: same logic on full history
  const sorted = completions.map((c) => c.completed_date).sort()
  let best = 0
  let run = 0
  let prevRequired: string | null = null

  for (const dateStr of sorted) {
    const date = new Date(dateStr + 'T00:00:00')
    if (!habit.specific_days.includes(getDay(date))) continue

    if (prevRequired) {
      // Find next required day after prevRequired
      let check = new Date(prevRequired + 'T00:00:00')
      check = subDays(check, 0)
      let found = false
      for (let i = 1; i <= 14; i++) {
        const next = new Date(check)
        next.setDate(next.getDate() + i)
        if (habit.specific_days.includes(getDay(next))) {
          if (format(next, 'yyyy-MM-dd') === dateStr) {
            run++
            found = true
          }
          break
        }
      }
      if (!found) run = 1
    } else {
      run = 1
    }
    if (run > best) best = run
    prevRequired = dateStr
  }

  return { current, best }
}

function calcWeeklyStreak(
  habit: Habit,
  completions: HabitCompletion[],
  today: Date,
): { current: number; best: number } {
  const target = habit.times_per_week ?? 1

  function weekDone(weekStart: Date): boolean {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
    const done = completions.filter((c) => {
      const d = new Date(c.completed_date + 'T00:00:00')
      return isWithinInterval(d, { start: weekStart, end: weekEnd })
    }).length
    return done >= target
  }

  // Current week start
  let weekStart = startOfWeek(today, { weekStartsOn: 1 })
  let current = 0

  while (weekDone(weekStart)) {
    current++
    weekStart = subDays(weekStart, 7)
  }

  // Best streak
  const allDates = completions.map((c) => new Date(c.completed_date + 'T00:00:00'))
  if (allDates.length === 0) return { current, best: current }

  const earliest = allDates.reduce((a, b) => (a < b ? a : b))
  let ws = startOfWeek(earliest, { weekStartsOn: 1 })
  const now = startOfWeek(today, { weekStartsOn: 1 })
  let best = 0
  let run = 0

  while (ws <= now) {
    if (weekDone(ws)) {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
    ws = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  return { current, best }
}

/** Human-readable recurrence label in Spanish */
export function getRecurrenceLabel(habit: Habit): string {
  switch (habit.recurrence_type) {
    case 'daily':
      return 'Todos los días'
    case 'times_per_week':
      return `${habit.times_per_week ?? 1} ${(habit.times_per_week ?? 1) === 1 ? 'vez' : 'veces'} por semana`
    case 'specific_days': {
      if (habit.specific_days.length === 0) return 'Sin días seleccionados'
      const sorted = [...habit.specific_days].sort()
      return sorted.map((d) => DAY_NAMES[d]).join(', ')
    }
  }
}

/** Returns all required dates in a date range for a habit (for heatmap) */
export function getHabitDatesInRange(habit: Habit, from: Date, to: Date): Date[] {
  const days = eachDayOfInterval({ start: from, end: to })
  return days.filter((d) => habitAppearsOnDate(habit, d))
}

/**
 * Returns the scheduled time for a habit on a specific date.
 * Priority: per-day override → habit default → null (all-day)
 */
export function getScheduledTimeForDate(
  habit: Habit,
  schedules: HabitSchedule[],
  date: Date,
): string | null {
  const dateStr = format(date, 'yyyy-MM-dd')
  const override = schedules.find((s) => s.habit_id === habit.id && s.scheduled_date === dateStr)
  return override?.scheduled_time ?? habit.scheduled_time ?? null
}

/** Convert 'HH:mm:ss' or 'HH:mm' to fractional hours (e.g. '07:30:00' → 7.5) */
export function timeStrToHour(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) + (m ?? 0) / 60
}

/** Convert fractional hours to 'HH:mm:ss' (e.g. 7.5 → '07:30:00') */
export function hourToTimeStr(hour: number): string {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}
