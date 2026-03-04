import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { filterService } from '@/services/filterService'
import { useAuth } from './useAuth'
import type { Filter } from '@/lib/types'

export const filterKeys = {
  all: ['filters'] as const,
  list: (userId: string) => [...filterKeys.all, userId] as const,
  detail: (id: string) => [...filterKeys.all, 'detail', id] as const,
}

export function useFilters() {
  const { user } = useAuth()
  return useQuery({
    queryKey: filterKeys.list(user?.id ?? ''),
    queryFn: () => filterService.getFilters(user!.id),
    enabled: !!user,
  })
}

export function useFilter(id: string) {
  return useQuery({
    queryKey: filterKeys.detail(id),
    queryFn: () => filterService.getFilter(id),
    enabled: !!id,
  })
}

export function useCreateFilter() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (filter: { name: string; query: string; color?: string; icon?: string | null }) =>
      filterService.createFilter({ ...filter, user_id: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: filterKeys.all })
    },
  })
}

export function useUpdateFilter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Pick<Filter, 'name' | 'query' | 'color' | 'icon' | 'is_favorite'>>
    }) => filterService.updateFilter(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: filterKeys.all })
    },
  })
}

export function useDeleteFilter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => filterService.deleteFilter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: filterKeys.all })
    },
  })
}
