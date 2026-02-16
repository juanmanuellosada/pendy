import { supabase } from '@/lib/supabase'
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
      .eq('is_completed', false)
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
      .eq('is_completed', false)
      .gte('due_date', today)
      .lte('due_date', future)
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
      .eq('is_completed', false)
      .is('parent_id', null)
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
    section_id?: string | null
    description?: string | null
    parent_id?: string | null
  }): Promise<Task> {
    const { data: maxOrder } = await supabase
      .from('tasks')
      .select('sort_order')
      .eq('project_id', task.project_id)
      .is('parent_id', task.parent_id ?? null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (maxOrder?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...task,
        priority: task.priority ?? 4,
        sort_order,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
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
