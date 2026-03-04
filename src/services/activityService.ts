import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/types'

export const activityService = {
  async log(entry: Omit<ActivityLog, 'id' | 'created_at'>) {
    const { error } = await supabase.from('activity_log').insert(entry)
    if (error) throw error
  },

  async getLatest(userId: string, limit = 1): Promise<ActivityLog[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  },

  async undo(entry: ActivityLog): Promise<void> {
    const { entity_type, entity_id, action, changes } = entry

    if (action === 'deleted') {
      // Can't undo deletes without storing full row — skip for now
      return
    }

    if (action === 'completed' && changes?.is_completed) {
      await supabase
        .from(entity_type === 'task' ? 'tasks' : entity_type)
        .update({
          is_completed: changes.is_completed.old as boolean,
          completed_at: null,
        })
        .eq('id', entity_id)
      return
    }

    if (action === 'updated' && changes) {
      const rollback: Record<string, unknown> = {}
      for (const [field, { old }] of Object.entries(changes)) {
        rollback[field] = old
      }
      const table = entity_type === 'task' ? 'tasks' : entity_type
      await supabase.from(table).update(rollback).eq('id', entity_id)
    }
  },

  async deleteEntry(id: string) {
    await supabase.from('activity_log').delete().eq('id', id)
  },
}
