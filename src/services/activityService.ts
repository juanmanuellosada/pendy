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

  async undo(entry: ActivityLog): Promise<string | null> {
    const { entity_type, entity_id, action, changes } = entry

    if (action === 'deleted' && entity_type === 'task' && changes?._snapshot) {
      const snapshot = changes._snapshot as Record<string, unknown>
      // Re-insert the task row (strip any extra keys that aren't columns)
      const { error } = await supabase.from('tasks').insert({
        id: entity_id,
        user_id: snapshot.user_id,
        project_id: snapshot.project_id,
        section_id: snapshot.section_id ?? null,
        parent_id: snapshot.parent_id ?? null,
        title: snapshot.title,
        description: snapshot.description ?? null,
        priority: snapshot.priority,
        due_date: snapshot.due_date ?? null,
        due_datetime: snapshot.due_datetime ?? null,
        has_time: snapshot.has_time ?? false,
        duration_minutes: snapshot.duration_minutes ?? null,
        is_completed: snapshot.is_completed ?? false,
        completed_at: snapshot.completed_at ?? null,
        is_recurring: snapshot.is_recurring ?? false,
        recurrence_rule: snapshot.recurrence_rule ?? null,
        recurrence_from: snapshot.recurrence_from ?? 'due_date',
        sort_order: snapshot.sort_order ?? 0,
        depth: snapshot.depth ?? 0,
        collapsed: snapshot.collapsed ?? false,
      })
      if (error) throw error
      return snapshot.title as string
    }

    if (action === 'completed' && changes?.is_completed) {
      const taskTitle = changes._title as string | undefined
      await supabase
        .from(entity_type === 'task' ? 'tasks' : entity_type)
        .update({
          is_completed: changes.is_completed.old as boolean,
          completed_at: null,
        })
        .eq('id', entity_id)
      return taskTitle ?? null
    }

    if (action === 'updated' && changes) {
      const taskTitle = changes._title as string | undefined
      const rollback: Record<string, unknown> = {}
      for (const [field, val] of Object.entries(changes)) {
        if (field === '_title') continue
        rollback[field] = (val as { old: unknown }).old
      }
      const table = entity_type === 'task' ? 'tasks' : entity_type
      await supabase.from(table).update(rollback).eq('id', entity_id)
      return taskTitle ?? null
    }

    return null
  },

  async deleteEntry(id: string) {
    await supabase.from('activity_log').delete().eq('id', id)
  },
}
