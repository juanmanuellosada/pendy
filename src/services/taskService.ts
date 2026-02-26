import { supabase } from '@/lib/supabase'
import { labelService } from './labelService'
import type { Task } from '@/lib/types'

export const taskService = {
  async getTasksByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_id', null)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getTasksDueToday(userId: string): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .lte('due_date', today)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getTasksUpcoming(userId: string, days: number = 30): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const future = futureDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('due_date', today)
      .lte('due_date', future)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getTasksByDateRange(userId: string, from: string, to: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('due_date', from)
      .lte('due_date', to)
      .order('due_date', { ascending: true })
      .order('priority', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getInboxTasks(userId: string): Promise<Task[]> {
    const { data: inboxProject } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .eq('is_inbox', true)
      .single()

    if (!inboxProject) return []

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', inboxProject.id)
      .is('parent_id', null)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getTaskById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async getSubtasks(parentId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createTask(task: {
    user_id: string
    project_id: string
    title: string
    priority?: number
    due_date?: string | null
    due_datetime?: string | null
    has_time?: boolean
    duration_minutes?: number | null
    section_id?: string | null
    description?: string | null
    parent_id?: string | null
    label_ids?: string[]
    is_recurring?: boolean
    recurrence_rule?: string | null
    recurrence_from?: 'due_date' | 'completion_date'
    deadline?: string | null
  }): Promise<Task> {
    const { label_ids, ...taskData } = task

    const { data: maxOrder } = await supabase
      .from('tasks')
      .select('sort_order')
      .eq('project_id', task.project_id)
      .is('parent_id', task.parent_id ?? null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sort_order = (maxOrder?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        priority: task.priority ?? 4,
        sort_order,
      })
      .select()
      .single()

    if (error) throw error

    if (label_ids && label_ids.length > 0) {
      await labelService.setTaskLabels(data.id, label_ids)
    }

    return data
  },

  async updateTask(
    id: string,
    updates: Partial<Task> & { label_ids?: string[] },
  ): Promise<Task> {
    const { label_ids, ...taskUpdates } = updates as Partial<Task> & { label_ids?: string[] }

    const { data, error } = await supabase
      .from('tasks')
      .update(taskUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    if (label_ids !== undefined) {
      await labelService.setTaskLabels(id, label_ids)
    }

    return data
  },

  async completeTask(id: string, completed: boolean): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },

  async getCompletedTasks(userId: string, limit = 50): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .is('parent_id', null)
      .order('completed_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data ?? []
  },

  async searchTasks(userId: string, query: string): Promise<Task[]> {
    if (!query.trim()) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${query.trim()}%`)
      .is('parent_id', null)
      .order('is_completed', { ascending: true })
      .order('due_date', { ascending: true })
      .limit(50)

    if (error) throw error
    return data ?? []
  },

  async reorderTasks(updates: { id: string; sort_order: number }[]): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('tasks').update({ sort_order }).eq('id', id),
      ),
    )
    const error = results.find((r) => r.error)?.error
    if (error) throw error
  },

  async moveTask(id: string, projectId: string, sectionId: string | null): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ project_id: projectId, section_id: sectionId })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },
}
