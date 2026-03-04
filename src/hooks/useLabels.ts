import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { labelService } from '@/services/labelService'
import { useAuth } from './useAuth'
import type { Label } from '@/lib/types'

export const labelKeys = {
  all: ['labels'] as const,
  list: (userId: string) => [...labelKeys.all, userId] as const,
  taskLabels: (taskId: string) => ['task_labels', taskId] as const,
  allTaskLabels: (userId: string) => ['all_task_labels', userId] as const,
}

export function useLabels() {
  const { user } = useAuth()
  return useQuery({
    queryKey: labelKeys.list(user?.id ?? ''),
    queryFn: () => labelService.getLabels(user!.id),
    enabled: !!user,
  })
}

export function useTaskLabels(taskId: string) {
  return useQuery({
    queryKey: labelKeys.taskLabels(taskId),
    queryFn: () => labelService.getTaskLabels(taskId),
    enabled: !!taskId,
  })
}

export function useAllTaskLabelsMap() {
  const { user } = useAuth()
  return useQuery({
    queryKey: labelKeys.allTaskLabels(user?.id ?? ''),
    queryFn: () => labelService.getAllTaskLabelsMap(user!.id),
    enabled: !!user,
  })
}

export function useCreateLabel() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (label: { name: string; color?: string }) =>
      labelService.createLabel({ ...label, user_id: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all })
    },
  })
}

export function useUpdateLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Pick<import('@/lib/types').Label, 'name' | 'color' | 'is_favorite'>>
    }) => labelService.updateLabel(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all })
    },
  })
}

export function useSetTaskLabels() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ taskId, labelIds }: { taskId: string; labelIds: string[] }) =>
      labelService.setTaskLabels(taskId, labelIds),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: labelKeys.taskLabels(taskId) })
      queryClient.invalidateQueries({ queryKey: labelKeys.allTaskLabels(user?.id ?? '') })
    },
  })
}

export function useDeleteLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => labelService.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: labelKeys.all })
    },
  })
}

/** Colores predefinidos para etiquetas */
export const LABEL_COLORS: string[] = [
  '#EC1E2A',
  '#F59E0B',
  '#22C55E',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#84CC16',
  '#06B6D4',
  '#E11D48',
  '#283B56',
  '#6B7280',
  '#9CA3AF',
]

export function getLabelColor(label: Label) {
  return label.color ?? '#6B7280'
}
