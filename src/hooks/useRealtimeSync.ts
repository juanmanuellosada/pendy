import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { taskKeys } from './useTasks'
import { labelKeys } from './useLabels'
import { filterKeys } from './useFilters'
import type { RealtimeChannel } from '@supabase/supabase-js'

const projectKeys = { all: ['projects'] as const }
const sectionKeys = { all: ['sections'] as const }
const commentKeys = { all: ['comments'] as const }
const reminderKeys = { all: ['reminders'] as const }

/**
 * Subscribes to Supabase Realtime postgres_changes for all user-owned tables.
 * On any INSERT/UPDATE/DELETE, invalidates the relevant TanStack Query caches.
 * This keeps data fresh across tabs and devices without manual refresh.
 */
export function useRealtimeSync() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`realtime:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: taskKeys.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: projectKeys.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sections', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: sectionKeys.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'labels', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: labelKeys.all })
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, () => {
        // task_labels doesn't have user_id, so we invalidate all label maps
        queryClient.invalidateQueries({ queryKey: labelKeys.allTaskLabels(user.id) })
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: commentKeys.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: reminderKeys.all })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'filters', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: filterKeys.all })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          queryClient.invalidateQueries()
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [user, queryClient])
}
