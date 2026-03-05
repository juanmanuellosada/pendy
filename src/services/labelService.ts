import { supabase } from '@/lib/supabase'
import type { Label } from '@/lib/types'

export const labelService = {
  async getLabels(userId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createLabel(label: { user_id: string; name: string; color?: string }): Promise<Label> {
    const { data: maxOrder } = await supabase
      .from('labels')
      .select('sort_order')
      .eq('user_id', label.user_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('labels')
      .insert({ ...label, sort_order: (maxOrder?.sort_order ?? -1) + 1 })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateLabel(
    id: string,
    updates: Partial<Pick<Label, 'name' | 'color' | 'is_favorite'>>,
  ): Promise<Label> {
    const { data, error } = await supabase
      .from('labels')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteLabel(id: string): Promise<void> {
    const { error } = await supabase.from('labels').delete().eq('id', id)
    if (error) throw error
  },

  async getTaskLabels(taskId: string): Promise<Label[]> {
    const { data, error } = await supabase
      .from('task_labels')
      .select('labels(*)')
      .eq('task_id', taskId)

    if (error) throw error
    return (data ?? []).map((row) => row.labels as unknown as Label)
  },

  /** Reemplaza todas las etiquetas de una tarea */
  async setTaskLabels(taskId: string, labelIds: string[]): Promise<void> {
    await supabase.from('task_labels').delete().eq('task_id', taskId)

    if (labelIds.length > 0) {
      const { error } = await supabase
        .from('task_labels')
        .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })))

      if (error) throw error
    }
  },

  /** Devuelve un array serializable de { task_id, labels }[] para todos los tasks del usuario */
  async getAllTaskLabelsRaw(userId: string): Promise<{ task_id: string; labels: Label[] }[]> {
    const { data, error } = await supabase
      .from('task_labels')
      .select(
        'task_id, labels!inner(id, user_id, name, color, is_favorite, sort_order, created_at)',
      )
      .eq('labels.user_id', userId)

    if (error) throw error

    const acc = new Map<string, Label[]>()
    ;(data ?? []).forEach((row) => {
      if (!acc.has(row.task_id)) acc.set(row.task_id, [])
      acc.get(row.task_id)!.push(row.labels as unknown as Label)
    })
    return Array.from(acc.entries()).map(([task_id, labels]) => ({ task_id, labels }))
  },
}
