import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '@/services/taskService'
import { labelKeys } from './useLabels'
import type { Task } from '@/lib/types'
import { useAuth } from './useAuth'

export const taskKeys = {
  all: ['tasks'] as const,
  inbox: (userId: string) => [...taskKeys.all, 'inbox', userId] as const,
  today: (userId: string) => [...taskKeys.all, 'today', userId] as const,
  upcoming: (userId: string, days?: number) => [...taskKeys.all, 'upcoming', userId, days] as const,
  completed: (userId: string) => [...taskKeys.all, 'completed', userId] as const,
  search: (userId: string, q: string) => [...taskKeys.all, 'search', userId, q] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  subtasks: (parentId: string) => [...taskKeys.all, 'subtasks', parentId] as const,
}

export function useInboxTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.inbox(user?.id ?? ''),
    queryFn: () => taskService.getInboxTasks(user!.id),
    enabled: !!user,
  })
}

export function useTodayTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.today(user?.id ?? ''),
    queryFn: () => taskService.getTasksDueToday(user!.id),
    enabled: !!user,
  })
}

export function useUpcomingTasks(days = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.upcoming(user?.id ?? '', days),
    queryFn: () => taskService.getTasksUpcoming(user!.id, days),
    enabled: !!user,
  })
}

export function useCalendarTasks(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...taskKeys.all, 'calendar', user?.id ?? '', from, to],
    queryFn: () => taskService.getTasksByDateRange(user!.id, from, to),
    enabled: !!user && !!from && !!to,
  })
}

export function useRecurringTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...taskKeys.all, 'recurring', user?.id ?? ''],
    queryFn: () => taskService.getRecurringTasks(user!.id),
    enabled: !!user,
    staleTime: 60_000,
  })
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.project(projectId),
    queryFn: () => taskService.getTasksByProject(projectId),
    enabled: !!projectId,
  })
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(id ?? ''),
    queryFn: () => taskService.getTaskById(id!),
    enabled: !!id,
  })
}

export function useSubtasks(parentId: string | null) {
  return useQuery({
    queryKey: taskKeys.subtasks(parentId ?? ''),
    queryFn: () => taskService.getSubtasks(parentId!),
    enabled: !!parentId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (task: Parameters<typeof taskService.createTask>[0]) =>
      taskService.createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: labelKeys.allTaskLabels(user?.id ?? '') })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> & { label_ids?: string[] } }) =>
      taskService.updateTask(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })

      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData(
            key,
            data.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          )
        }
      })

      return { queries }
    },
    onError: (_err, _vars, context) => {
      context?.queries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: labelKeys.taskLabels(id) })
      queryClient.invalidateQueries({ queryKey: labelKeys.allTaskLabels(user?.id ?? '') })
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, completed, task }: { id: string; completed: boolean; task?: Task }) =>
      taskService.completeTask(id, completed, task),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })

      queries.forEach(([key, data]) => {
        if (Array.isArray(data)) {
          queryClient.setQueryData(
            key,
            data.map((t) =>
              t.id === id
                ? { ...t, is_completed: completed, completed_at: completed ? new Date().toISOString() : null }
                : t,
            ),
          )
        }
      })

      return { queries }
    },
    onError: (_err, _vars, context) => {
      context?.queries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useCompletedTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.completed(user?.id ?? ''),
    queryFn: () => taskService.getCompletedTasks(user!.id),
    enabled: !!user,
  })
}

export function useTasksByLabel(labelId: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...taskKeys.all, 'label', labelId, user?.id ?? ''],
    queryFn: () => taskService.getTasksByLabel(user!.id, labelId),
    enabled: !!user && !!labelId,
  })
}

export function useTaskCountsByProject() {
  const { user } = useAuth()
  return useQuery({
    queryKey: [...taskKeys.all, 'counts', user?.id ?? ''],
    queryFn: () => taskService.getTaskCountsByProject(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useSearchTasks(query: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.search(user?.id ?? '', query),
    queryFn: () => taskService.searchTasks(user!.id, query),
    enabled: !!user && query.trim().length >= 2,
    staleTime: 0,
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ updates }: { projectId: string; updates: { id: string; sort_order: number }[] }) =>
      taskService.reorderTasks(updates),
    onMutate: async ({ projectId, updates }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.project(projectId) })
      const prev = queryClient.getQueryData<Task[]>(taskKeys.project(projectId))
      if (prev) {
        const map = new Map(updates.map((u) => [u.id, u.sort_order]))
        queryClient.setQueryData(
          taskKeys.project(projectId),
          [...prev]
            .map((t) => (map.has(t.id) ? { ...t, sort_order: map.get(t.id)! } : t))
            .sort((a, b) => a.sort_order - b.sort_order),
        )
      }
      return { prev }
    },
    onError: (_err, { projectId }, context) => {
      if (context?.prev) queryClient.setQueryData(taskKeys.project(projectId), context.prev)
    },
    onSettled: (_d, _e, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.project(projectId) })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
