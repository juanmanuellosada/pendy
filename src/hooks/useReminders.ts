import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reminderService } from '@/services/reminderService'
import { useAuth } from './useAuth'

export function useTaskReminders(taskId: string) {
  return useQuery({
    queryKey: ['reminders', taskId],
    queryFn: () => reminderService.getTaskReminders(taskId),
    enabled: !!taskId,
  })
}

export function useCreateReminder() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (params: { task_id: string; remind_at: string; type?: 'push' | 'email' }) =>
      reminderService.createReminder({ ...params, user_id: user!.id }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reminders', vars.task_id] })
    },
  })
}

export function useDeleteReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { id: string; task_id: string }) =>
      reminderService.deleteReminder(params.id),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['reminders', vars.task_id] })
    },
  })
}
