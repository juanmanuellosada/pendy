import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { taskService } from '@/services/taskService'
import { activityService } from '@/services/activityService'
import { labelKeys } from './useLabels'
import type { Task } from '@/lib/types'
import { useAuth } from './useAuth'
import { useInboxProject } from './useProjects'

export const taskKeys = {
  all: ['tasks'] as const,
  allUser: (userId: string) => [...taskKeys.all, 'allUser', userId] as const,
  inbox: (userId: string) => [...taskKeys.all, 'inbox', userId] as const,
  today: (userId: string) => [...taskKeys.all, 'today', userId] as const,
  upcoming: (userId: string, days?: number) => [...taskKeys.all, 'upcoming', userId, days] as const,
  completed: (userId: string) => [...taskKeys.all, 'completed', userId] as const,
  search: (userId: string, q: string) => [...taskKeys.all, 'search', userId, q] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  subtasks: (parentId: string) => [...taskKeys.all, 'subtasks', parentId] as const,
}

export function useAllUserTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.allUser(user?.id ?? ''),
    queryFn: () => taskService.getAllUserTasks(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useInboxTasks() {
  const { user } = useAuth()
  const { data: inboxProject } = useInboxProject()
  return useQuery({
    queryKey: taskKeys.inbox(user?.id ?? ''),
    queryFn: () => taskService.getInboxTasks(inboxProject!.id),
    enabled: !!user && !!inboxProject,
    staleTime: 30_000,
  })
}

export function useTodayTasks() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.today(user?.id ?? ''),
    queryFn: () => taskService.getTasksDueToday(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  })
}

export function useUpcomingTasks(days = 30) {
  const { user } = useAuth()
  return useQuery({
    queryKey: taskKeys.upcoming(user?.id ?? '', days),
    queryFn: () => taskService.getTasksUpcoming(user!.id, days),
    enabled: !!user,
    staleTime: 30_000,
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
    staleTime: 30_000,
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
    onError: () => {
      toast.error('No se pudo crear la tarea')
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Task> & { label_ids?: string[] }
    }) => taskService.updateTask(id, updates),
    onMutate: async ({ id, updates }) => {
      const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })
      const snapshots: [readonly unknown[], Task[]][] = []
      let oldTask: Task | undefined

      for (const [key, data] of queries) {
        if (Array.isArray(data) && data.some((t) => t.id === id)) {
          await queryClient.cancelQueries({ queryKey: key })
          snapshots.push([key, data])
          if (!oldTask) oldTask = data.find((t) => t.id === id)
          queryClient.setQueryData(
            key,
            data.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          )
        }
      }

      return { snapshots, oldTask }
    },
    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
      toast.error('No se pudo actualizar la tarea')
    },
    onSuccess: (_data, { id, updates }, context) => {
      if (user && context?.oldTask) {
        const oldTask = context.oldTask
        const loggableKeys = Object.keys(updates).filter((k) => k !== 'label_ids')
        if (loggableKeys.length > 0) {
          const changes: Record<string, { old: unknown; new: unknown }> = {
            _title: { old: oldTask.title, new: oldTask.title },
          }
          for (const key of loggableKeys) {
            changes[key] = {
              old: oldTask[key as keyof Task],
              new: updates[key as keyof typeof updates],
            }
          }
          activityService
            .log({
              user_id: user.id,
              entity_type: 'task',
              entity_id: id,
              action: 'updated',
              changes,
            })
            .catch(() => {})
        }
      }
    },
    onSettled: (_data, _err, { id }, context) => {
      // Only invalidate queries that actually contained this task
      context?.snapshots.forEach(([key]) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: labelKeys.taskLabels(id) })
      queryClient.invalidateQueries({ queryKey: labelKeys.allTaskLabels(user?.id ?? '') })
    },
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ id, completed, task }: { id: string; completed: boolean; task?: Task }) =>
      taskService.completeTask(id, completed, task),
    onMutate: async ({ id, completed }) => {
      const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })
      const snapshots: [readonly unknown[], Task[]][] = []

      for (const [key, data] of queries) {
        if (Array.isArray(data) && data.some((t) => t.id === id)) {
          await queryClient.cancelQueries({ queryKey: key })
          snapshots.push([key, data])
          queryClient.setQueryData(
            key,
            data.map((t) =>
              t.id === id
                ? {
                    ...t,
                    is_completed: completed,
                    completed_at: completed ? new Date().toISOString() : null,
                  }
                : t,
            ),
          )
        }
      }

      return { snapshots }
    },
    onError: (_err, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
      toast.error('No se pudo completar la tarea')
    },
    onSuccess: (_data, { id, completed, task }) => {
      if (user) {
        activityService
          .log({
            user_id: user.id,
            entity_type: 'task',
            entity_id: id,
            action: 'completed',
            changes: {
              _title: { old: task?.title, new: task?.title },
              is_completed: { old: !completed, new: completed },
            },
          })
          .catch(() => {})
      }
    },
    onSettled: (_data, _err, _vars, context) => {
      // Only invalidate queries that actually contained this task
      context?.snapshots.forEach(([key]) => {
        queryClient.invalidateQueries({ queryKey: key })
      })
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
    mutationFn: ({
      updates,
    }: {
      projectId: string
      updates: { id: string; sort_order: number }[]
    }) => taskService.reorderTasks(updates),
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
      toast.error('No se pudo reordenar las tareas')
    },
    onSettled: (_d, _e, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.project(projectId) })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (idOrTask: string | Task) => {
      const id = typeof idOrTask === 'string' ? idOrTask : idOrTask.id
      if (user) {
        // Find task snapshot from cache for undo
        let snapshot: Task | undefined = typeof idOrTask === 'object' ? idOrTask : undefined
        if (!snapshot) {
          const queries = queryClient.getQueriesData<Task[]>({ queryKey: taskKeys.all })
          for (const [, data] of queries) {
            if (Array.isArray(data)) {
              snapshot = data.find((t) => t.id === id)
              if (snapshot) break
            }
          }
        }
        if (snapshot) {
          activityService
            .log({
              user_id: user.id,
              entity_type: 'task',
              entity_id: id,
              action: 'deleted',
              changes: { _snapshot: { old: snapshot, new: null } },
            })
            .catch(() => {})
        }
      }
      return taskService.deleteTask(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: () => {
      toast.error('No se pudo eliminar la tarea')
    },
  })
}
