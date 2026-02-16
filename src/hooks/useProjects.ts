import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectService } from '@/services/projectService'
import type { Project } from '@/lib/types'
import { useAuth } from './useAuth'

export const projectKeys = {
  all: ['projects'] as const,
  list: (userId: string) => [...projectKeys.all, 'list', userId] as const,
  inbox: (userId: string) => [...projectKeys.all, 'inbox', userId] as const,
}

export function useProjects() {
  const { user } = useAuth()
  return useQuery({
    queryKey: projectKeys.list(user?.id ?? ''),
    queryFn: () => projectService.getProjects(user!.id),
    enabled: !!user,
  })
}

export function useInboxProject() {
  const { user } = useAuth()
  return useQuery({
    queryKey: projectKeys.inbox(user?.id ?? ''),
    queryFn: () => projectService.getInboxProject(user!.id),
    enabled: !!user,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (project: Parameters<typeof projectService.createProject>[0]) =>
      projectService.createProject(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Project> }) =>
      projectService.updateProject(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useArchiveProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectService.archiveProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => projectService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useToggleProjectFavorite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      projectService.toggleFavorite(id, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
