import { supabase } from '@/lib/supabase'
import type { Reminder } from '@/lib/types'

export const reminderService = {
  async getTaskReminders(taskId: string): Promise<Reminder[]> {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('task_id', taskId)
      .order('remind_at', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createReminder(reminder: {
    user_id: string
    task_id: string
    remind_at: string
    type?: 'push' | 'email'
  }): Promise<Reminder> {
    const { data, error } = await supabase
      .from('reminders')
      .insert({
        ...reminder,
        type: reminder.type ?? 'push',
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteReminder(id: string): Promise<void> {
    const { error } = await supabase.from('reminders').delete().eq('id', id)
    if (error) throw error
  },
}
