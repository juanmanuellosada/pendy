import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commentService } from '@/services/commentService'
import { useAuth } from './useAuth'

export const commentKeys = {
  all: ['comments'] as const,
  list: (taskId: string) => [...commentKeys.all, taskId] as const,
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: commentKeys.list(taskId),
    queryFn: () => commentService.getComments(taskId),
    enabled: !!taskId,
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      commentService.createComment({ user_id: user!.id, task_id: taskId, content }),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) })
    },
  })
}

export function useUpdateComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string; taskId: string }) =>
      commentService.updateComment(id, content),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; taskId: string }) => commentService.deleteComment(id),
    onSuccess: (_data, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) })
    },
  })
}
