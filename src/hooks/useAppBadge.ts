import { useEffect } from 'react'
import { useTodayTasks } from '@/hooks/useTasks'
import { useTodayHabits, useHabitCompletions } from '@/hooks/useHabits'
import { useUIStore } from '@/stores/uiStore'

/**
 * Sincroniza el badge del ícono de la PWA con el conteo de tareas pendientes para hoy.
 * Usa la Badging API (navigator.setAppBadge / clearAppBadge).
 */
export function useAppBadge() {
  const { data: todayTasks = [] } = useTodayTasks()
  const { data: todayHabits = [] } = useTodayHabits()
  const todayDateKey = new Date().toISOString().slice(0, 10)
  const { data: habitCompletions = [] } = useHabitCompletions(todayDateKey, todayDateKey)
  const { getViewOptions } = useUIStore()

  const todayViewOpts = getViewOptions('today')
  const showHabitsInToday = todayViewOpts.showHabits ?? true

  const pendingHabitsCount = showHabitsInToday
    ? todayHabits.filter(
        (h) =>
          !habitCompletions.some(
            (c) => c.habit_id === h.id && c.completed_date === todayDateKey,
          ),
      ).length
    : 0

  const todayCount =
    todayTasks.filter((t) => !t.is_completed).length + pendingHabitsCount

  useEffect(() => {
    if (!('setAppBadge' in navigator)) return

    if (todayCount > 0) {
      navigator.setAppBadge(todayCount).catch(() => {})
    } else {
      navigator.clearAppBadge?.().catch(() => {})
    }
  }, [todayCount])
}
