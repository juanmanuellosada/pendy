import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '@/services/taskService'
import type { Task } from '@/lib/types'
import { useAuth } from './useAuth'

export const taskKeys = {
  all: ['tasks'] as const,
  inbox: (userId: string) => [...taskKeys.all, 'inbox', userId] as const,
  today: (userId: string) => [...taskKeys.all, 'today', userId] as const,
  upcoming: (userId: string) => [...taskKeys.all, 'upcoming', userId] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
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
    queryKey: taskKeys.upcoming(user?.id ?? ''),
    queryFn: () => taskService.getTasksUpcoming(user!.id, days),
    enabled: !!user,
  })
}

export function useProjectTasks(projectId: string) {
  return useQuery({
    queryKey: taskKeys.project(projectId),
    queryFn: () => taskService.getTasksByProject(projectId),
    enabled: !!projectId,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Parameters<typeof taskService.createTask>[0]) =>
      taskService.createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      taskService.updateTask(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      taskService.completeTask(id, completed),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })

      queries.forEach(([key, data]) => {
        if (data) {
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

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
