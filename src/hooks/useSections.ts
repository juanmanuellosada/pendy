import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sectionService } from '@/services/sectionService'
import { taskKeys } from './useTasks'
import { useAuth } from './useAuth'
import type { Section } from '@/lib/types'

export const sectionKeys = {
  all: ['sections'] as const,
  project: (projectId: string) => [...sectionKeys.all, 'project', projectId] as const,
}

export function useProjectSections(projectId: string | undefined) {
  return useQuery({
    queryKey: sectionKeys.project(projectId ?? ''),
    queryFn: () => sectionService.getSectionsByProject(projectId!),
    enabled: !!projectId,
  })
}

export function useCreateSection() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (section: { project_id: string; name: string }) =>
      sectionService.createSection({ ...section, user_id: user!.id }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: sectionKeys.project(variables.project_id),
      })
    },
  })
}

export function useUpdateSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      projectId: string
      updates: Partial<Pick<Section, 'name' | 'collapsed' | 'sort_order'>>
    }) => sectionService.updateSection(id, updates),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: sectionKeys.project(projectId),
      })
    },
  })
}

export function useDeleteSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      sectionService.deleteSection(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: sectionKeys.project(projectId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
