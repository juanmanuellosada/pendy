import { supabase } from '@/lib/supabase'
import { labelService } from './labelService'
import { rrulestr } from 'rrule'
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

  async getRecurringTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .eq('is_completed', false)

    if (error) throw error
    return data ?? []
  },

  async getInboxTasks(userId: string, inboxProjectId?: string): Promise<Task[]> {
    let projectId = inboxProjectId
    if (!projectId) {
      const { data: inboxProject } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', userId)
        .eq('is_inbox', true)
        .single()
      projectId = inboxProject?.id
    }

    if (!projectId) return []

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('parent_id', null)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getTaskById(id: string): Promise<Task | null> {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()

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

  async updateTask(id: string, updates: Partial<Task> & { label_ids?: string[] }): Promise<Task> {
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

  async completeTask(id: string, completed: boolean, task?: Task): Promise<Task> {
    // Run completion update and next recurrence creation in parallel
    const updatePromise = supabase
      .from('tasks')
      .update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single()

    const recurrencePromise =
      completed && task?.is_recurring && task?.recurrence_rule
        ? this._createNextRecurrence(task)
        : Promise.resolve()

    const [{ data, error }] = await Promise.all([updatePromise, recurrencePromise])

    if (error) throw error
    return data
  },

  async _createNextRecurrence(task: Task): Promise<void> {
    const now = new Date()
    let baseDate: Date

    if (task.recurrence_from === 'completion_date') {
      baseDate = now
    } else {
      baseDate = task.due_date ? new Date(task.due_date + 'T12:00:00') : now
    }

    try {
      const rule = rrulestr(task.recurrence_rule!, { dtstart: baseDate })
      // Get the next occurrence strictly after the base date
      const nextDate = rule.after(baseDate, false)

      if (!nextDate) return // No more occurrences (e.g. UNTIL was reached)

      const nextDueDate = nextDate.toISOString().split('T')[0]

      // Fetch labels and create next task in parallel
      const [{ data: taskLabels }, { data: newTask, error }] = await Promise.all([
        supabase.from('task_labels').select('label_id').eq('task_id', task.id),
        supabase
          .from('tasks')
          .insert({
            user_id: task.user_id,
            project_id: task.project_id,
            section_id: task.section_id,
            parent_id: task.parent_id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            due_date: nextDueDate,
            due_datetime:
              task.has_time && task.due_datetime
                ? new Date(nextDueDate + 'T' + task.due_datetime.split('T')[1]).toISOString()
                : null,
            has_time: task.has_time,
            duration_minutes: task.duration_minutes,
            is_recurring: true,
            recurrence_rule: task.recurrence_rule,
            recurrence_from: task.recurrence_from,
            deadline: task.deadline,
            sort_order: task.sort_order,
            depth: task.depth,
          })
          .select()
          .single(),
      ])

      if (error) throw error

      // Copy labels to the new task
      const labelIds = (taskLabels ?? []).map((tl) => tl.label_id as string)
      if (newTask && labelIds.length > 0) {
        await labelService.setTaskLabels(newTask.id, labelIds)
      }
    } catch {
      // If rrule parsing fails, silently skip creating next occurrence
      console.warn('Failed to create next recurrence for task', task.id)
    }
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

  async getTasksByLabel(userId: string, labelId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_labels!inner(label_id)')
      .eq('task_labels.label_id', labelId)
      .eq('user_id', userId)
      .is('parent_id', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })

    if (error) throw error
    return (data ?? []).map(({ task_labels: _, ...task }) => task) as Task[]
  },

  async getTaskCountsByProject(userId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .is('parent_id', null)

    if (error) throw error
    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
      counts[row.project_id] = (counts[row.project_id] ?? 0) + 1
    }
    return counts
  },

  async reorderTasks(updates: { id: string; sort_order: number }[]): Promise<void> {
    const { error } = await supabase.rpc('batch_reorder_tasks', {
      task_ids: updates.map((u) => u.id),
      sort_orders: updates.map((u) => u.sort_order),
    })
    if (error) throw error
  },

  async getAllUserTasks(userId: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('parent_id', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: true })

    if (error) throw error
    return data ?? []
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
