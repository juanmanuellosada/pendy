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
      // Native desktop path: emit a Tauri event (instead of invoke command,
      // because Tauri 2's ACL rejects custom app-level commands without a
      // plugin namespace — events use core:event:default which is permissive).
      void (async () => {
        try {
          const { emit } = await import('@tauri-apps/api/event')
          await emit('set-app-badge', { count: todayCount })
        } catch (e) {
          console.warn('[badge] tauri emit failed', e)
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
