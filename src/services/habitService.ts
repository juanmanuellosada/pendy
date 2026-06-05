import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import type { Habit, HabitCompletion, HabitSchedule } from '@/lib/types'

export const habitService = {
  async getHabits(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getArchivedHabits(userId: string): Promise<Habit[]> {
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', true)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async createHabit(habit: Omit<Habit, 'id' | 'created_at' | 'updated_at'>): Promise<Habit> {
    const { data, error } = await supabase.from('habits').insert(habit).select().single()

    if (error) throw error
    return data
  },

  async updateHabit(id: string, updates: Partial<Omit<Habit, 'id' | 'user_id'>>): Promise<Habit> {
    const { data, error } = await supabase
      .from('habits')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteHabit(id: string): Promise<void> {
    const { error } = await supabase.from('habits').delete().eq('id', id)
    if (error) throw error
  },

  async getCompletions(userId: string, from: string, to: string): Promise<HabitCompletion[]> {
    const { data, error } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_date', from)
      .lte('completed_date', to)
      .order('completed_date', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getSchedulesForDateRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<HabitSchedule[]> {
    const { data, error } = await supabase
      .from('habit_schedules')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async setHabitDefaultTime(habitId: string, time: string): Promise<Habit> {
    const { data, error } = await supabase
      .from('habits')
      .update({ scheduled_time: time })
      .eq('id', habitId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async upsertHabitSchedule(
    habitId: string,
    userId: string,
    date: string,
    time: string,
  ): Promise<HabitSchedule> {
    const { data, error } = await supabase
      .from('habit_schedules')
      .upsert(
        { habit_id: habitId, user_id: userId, scheduled_date: date, scheduled_time: time },
        { onConflict: 'habit_id,scheduled_date' },
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async toggleCompletion(
    habitId: string,
    userId: string,
    date: Date,
  ): Promise<{ completed: boolean; completion: HabitCompletion | null }> {
    const dateStr = format(date, 'yyyy-MM-dd')

    // Check if already completed
    const { data: existing } = await supabase
      .from('habit_completions')
      .select('*')
      .eq('habit_id', habitId)
      .eq('completed_date', dateStr)
      .maybeSingle()

    if (existing) {
      // Delete (toggle off)
      const { error } = await supabase.from('habit_completions').delete().eq('id', existing.id)
      if (error) throw error
      return { completed: false, completion: null }
    } else {
      // Insert (toggle on)
      const { data, error } = await supabase
        .from('habit_completions')
        .insert({ habit_id: habitId, user_id: userId, completed_date: dateStr })
        .select()
        .single()
      if (error) throw error
      return { completed: true, completion: data }
    }
  },
}
