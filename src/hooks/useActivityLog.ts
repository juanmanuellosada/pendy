import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { activityService } from '@/services/activityService'
import { useAuth } from './useAuth'
import { taskKeys } from './useTasks'
import type { ActivityLog } from '@/lib/types'

export function useLogActivity() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: (entry: Omit<ActivityLog, 'id' | 'created_at' | 'user_id'>) =>
      activityService.log({ ...entry, user_id: user!.id }),
  })
}

export function useUndo() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!user) return null
      const [latest] = await activityService.getLatest(user.id, 1)
      if (!latest) {
        toast.info('Nada que deshacer')
        return null
      }
      const title = await activityService.undo(latest)
      await activityService.deleteEntry(latest.id)
      return { action: latest.action, title }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      if (!result) return
      const label = result.title ? `"${result.title}"` : 'acción'
      if (result.action === 'completed') {
        toast.success(`Completar ${label} deshecho`)
      } else if (result.action === 'deleted') {
        toast.success(`Eliminación de ${label} deshecha`)
      } else if (result.action === 'updated') {
        toast.success(`Edición de ${label} deshecha`)
      } else {
        toast.success('Acción deshecha')
      }
    },
    onError: () => {
      toast.error('No se pudo deshacer la acción')
    },
  })
}
