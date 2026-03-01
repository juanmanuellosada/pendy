import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { habitService } from '@/services/habitService'
import { habitAppearsOnDate } from '@/lib/habitUtils'
import { useAuth } from './useAuth'
import type { Habit, HabitCompletion, HabitSchedule } from '@/lib/types'

export const habitKeys = {
  all: ['habits'] as const,
  list: (userId: string) => [...habitKeys.all, 'list', userId] as const,
  completions: (userId: string, from: string, to: string) =>
    [...habitKeys.all, 'completions', userId, from, to] as const,
  allCompletions: (userId: string) => [...habitKeys.all, 'completions', userId] as const,
}

export const habitScheduleKeys = {
  all: ['habit_schedules'] as const,
  range: (userId: string, from: string, to: string) =>
    [...habitScheduleKeys.all, userId, from, to] as const,
}

// ── Queries ────────────────────────────────────────────────────────────────────

export function useHabits() {
  const { user } = useAuth()
  return useQuery({
    queryKey: habitKeys.list(user?.id ?? ''),
    queryFn: () => habitService.getHabits(user!.id),
    enabled: !!user,
  })
}

export function useTodayHabits() {
  const { data: habits = [], ...rest } = useHabits()
  const today = new Date()
  const todayHabits = habits.filter((h) => habitAppearsOnDate(h, today))
  return { data: todayHabits, ...rest }
}

export function useHabitCompletions(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: habitKeys.completions(user?.id ?? '', from, to),
    queryFn: () => habitService.getCompletions(user!.id, from, to),
    enabled: !!user && !!from && !!to,
  })
}

/** Fetch completions for the past 90 days (for streak/stats calculations) */
export function useHabitCompletionsExtended() {
  const { user } = useAuth()
  const to = format(new Date(), 'yyyy-MM-dd')
  const from = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  return useQuery({
    queryKey: habitKeys.completions(user?.id ?? '', from, to),
    queryFn: () => habitService.getCompletions(user!.id, from, to),
    enabled: !!user,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────────────

export function useToggleHabitCompletion() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: Date }) =>
      habitService.toggleCompletion(habitId, user!.id, date),

    onMutate: async ({ habitId, date }) => {
      const dateStr = format(date, 'yyyy-MM-dd')

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: habitKeys.all })

      // Snapshot ALL completion caches for this user (any date range)
      const snapshots = queryClient.getQueriesData<HabitCompletion[]>({
        queryKey: habitKeys.allCompletions(user!.id),
      })

      // Determine current completion state from any available cache
      const alreadyDone = snapshots
        .flatMap(([, data]) => data ?? [])
        .some((c) => c.habit_id === habitId && c.completed_date === dateStr)

      const optimistic: HabitCompletion = {
        id: `optimistic-${Date.now()}`,
        user_id: user!.id,
        habit_id: habitId,
        completed_date: dateStr,
        created_at: new Date().toISOString(),
      }

      // Apply optimistic update to ALL completion caches (covers any date range in use)
      queryClient.setQueriesData<HabitCompletion[]>(
        { queryKey: habitKeys.allCompletions(user!.id) },
        (prev) => {
          if (!prev) return prev
          if (alreadyDone) {
            return prev.filter((c) => !(c.habit_id === habitId && c.completed_date === dateStr))
          }
          return [...prev, optimistic]
        },
      )

      return { snapshots }
    },

    onError: (_err, _vars, context) => {
      // Restore all caches to their previous state
      if (context?.snapshots) {
        for (const [queryKey, data] of context.snapshots) {
          queryClient.setQueryData(queryKey, data)
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.all })
    },
  })
}

export function useCreateHabit() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (habit: Omit<Habit, 'id' | 'created_at' | 'updated_at'>) =>
      habitService.createHabit(habit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.list(user!.id) })
    },
  })
}

export function useUpdateHabit() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Habit, 'id' | 'user_id'>> }) =>
      habitService.updateHabit(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.list(user!.id) })
    },
  })
}

export function useDeleteHabit() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => habitService.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.list(user!.id) })
    },
  })
}

// ── Schedule hooks ──────────────────────────────────────────────────────────────

export function useHabitSchedules(from: string, to: string) {
  const { user } = useAuth()
  return useQuery<HabitSchedule[]>({
    queryKey: habitScheduleKeys.range(user?.id ?? '', from, to),
    queryFn: () => habitService.getSchedulesForDateRange(user!.id, from, to),
    enabled: !!user && !!from && !!to,
  })
}

export function useSetHabitDefaultTime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ habitId, time }: { habitId: string; time: string }) =>
      habitService.setHabitDefaultTime(habitId, time),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.list(user!.id) })
    },
  })
}

export function useUpsertHabitSchedule() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ habitId, date, time }: { habitId: string; date: string; time: string }) =>
      habitService.upsertHabitSchedule(habitId, user!.id, date, time),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitScheduleKeys.all })
    },
  })
}
