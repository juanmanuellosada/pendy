import { useEffect } from 'react'
import { format } from 'date-fns'
import { useTodayTasks } from '@/hooks/useTasks'
import { useTodayHabits, useHabitCompletions } from '@/hooks/useHabits'
import { useUIStore } from '@/stores/uiStore'
import { isTauri } from '@/lib/platform'

/**
 * Sincroniza el badge del ícono de la PWA con el conteo de tareas pendientes para hoy.
 * Usa la Badging API desde el main thread (desktop/Android) y envía un mensaje
 * al Service Worker como fallback (iOS PWA).
 */
export function useAppBadge() {
  const { data: todayTasks = [] } = useTodayTasks()
  const { data: todayHabits = [] } = useTodayHabits()
  const todayDateKey = format(new Date(), 'yyyy-MM-dd')
  const { data: habitCompletions = [] } = useHabitCompletions(todayDateKey, todayDateKey)
  const { getViewOptions } = useUIStore()

  const todayViewOpts = getViewOptions('today')
  const showHabitsInToday = todayViewOpts.showHabits ?? true

  const pendingHabitsCount = showHabitsInToday
    ? todayHabits.filter(
        (h) =>
          !habitCompletions.some((c) => c.habit_id === h.id && c.completed_date === todayDateKey),
      ).length
    : 0

  const todayCount = todayTasks.filter((t) => !t.is_completed).length + pendingHabitsCount

  useEffect(() => {
    if (todayCount === undefined) return

    if (isTauri()) {
      // Native desktop path: invoke Tauri command (dynamic import keeps this
      // module out of the PWA bundle entirely)
      void (async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('set_app_badge', { count: todayCount })
        } catch (e) {
          console.warn('[badge] tauri invoke failed', e)
        }
      })()
      return
    }

    // PWA path (unchanged):
    // 1. Try Badging API from main thread (works on desktop + Android)
    if ('setAppBadge' in navigator) {
      if (todayCount > 0) {
        navigator.setAppBadge(todayCount).catch(() => {})
      } else {
        navigator.clearAppBadge?.().catch(() => {})
      }
    }

    // 2. Also send to Service Worker (works on iOS PWA)
    navigator.serviceWorker?.controller?.postMessage({
      type: 'SET_BADGE',
      count: todayCount,
    })
  }, [todayCount])
}
