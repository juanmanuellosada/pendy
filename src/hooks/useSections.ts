import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sectionService } from '@/services/sectionService'
import { taskKeys } from './useTasks'
import { useAuth } from './useAuth'
import type { Section } from '@/lib/types'

export const sectionKeys = {
  all: ['sections'] as const,
  allSections: ['sections', 'all'] as const,
  project: (projectId: string) => [...sectionKeys.all, 'project', projectId] as const,
}

export function useProjectSections(projectId: string | undefined) {
  return useQuery({
    queryKey: sectionKeys.project(projectId ?? ''),
    queryFn: () => sectionService.getSectionsByProject(projectId!),
    enabled: !!projectId,
  })
}

/** Devuelve un Map<projectId, Section[]> con todas las secciones del usuario. */
export function useAllSections() {
  return useQuery({
    queryKey: sectionKeys.allSections,
    // queryFn returns a plain array (serializable by the IndexedDB persister)
    queryFn: () => sectionService.getAllSections(),
    staleTime: 1000 * 60,
    // select converts the array to a Map on every read — not stored in cache
    select: (sections) => {
      const map = new Map<string, Section[]>()
      for (const s of sections) {
        const arr = map.get(s.project_id) ?? []
        arr.push(s)
        map.set(s.project_id, arr)
      }
      return map
    },
  })
}

export function useCreateSection() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (section: { project_id: string; name: string }) =>
      sectionService.createSection({ ...section, user_id: user!.id }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: sectionKeys.project(variables.project_id),
      })
      const prev = queryClient.getQueryData<Section[]>(sectionKeys.project(variables.project_id))
      const maxOrder = prev?.reduce((max, s) => Math.max(max, s.sort_order), -1) ?? -1
      const optimistic: Section = {
        id: `temp-${Date.now()}`,
        user_id: user!.id,
        project_id: variables.project_id,
        name: variables.name,
        sort_order: maxOrder + 1,
        collapsed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData(sectionKeys.project(variables.project_id), [
        ...(prev ?? []),
        optimistic,
      ])
      return { prev }
    },
    onError: (_err, variables, context) => {
      if (context?.prev) {
        queryClient.setQueryData(sectionKeys.project(variables.project_id), context.prev)
      }
    },
    onSettled: (_data, _err, variables) => {
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

export function useReorderSections() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      updates,
    }: {
      projectId: string
      updates: { id: string; sort_order: number }[]
    }) => sectionService.reorderSections(updates),
    onMutate: async ({ projectId, updates }) => {
      await queryClient.cancelQueries({ queryKey: sectionKeys.project(projectId) })
      const prev = queryClient.getQueryData<Section[]>(sectionKeys.project(projectId))
      if (prev) {
        const map = new Map(updates.map((u) => [u.id, u.sort_order]))
        queryClient.setQueryData(
          sectionKeys.project(projectId),
          [...prev]
            .map((s) => (map.has(s.id) ? { ...s, sort_order: map.get(s.id)! } : s))
            .sort((a, b) => a.sort_order - b.sort_order),
        )
      }
      return { prev }
    },
    onError: (_err, { projectId }, context) => {
      if (context?.prev) queryClient.setQueryData(sectionKeys.project(projectId), context.prev)
    },
    onSettled: (_d, _e, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: sectionKeys.project(projectId) })
    },
  })
}

export function useDeleteSection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => sectionService.deleteSection(id),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: sectionKeys.project(projectId),
      })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}
