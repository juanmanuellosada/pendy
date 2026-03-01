import { supabase } from '@/lib/supabase'
import type { Project } from '@/lib/types'

export const projectService = {
  async getProjects(userId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getInboxProject(userId: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_inbox', true)
      .single()

    if (error) return null
    return data
  },

  async createProject(project: {
    user_id: string
    name: string
    color?: string
    icon?: string | null
    description?: string | null
    parent_id?: string | null
  }): Promise<Project> {
    const { data: maxOrder } = await supabase
      .from('projects')
      .select('sort_order')
      .eq('user_id', project.user_id)
      .is('parent_id', project.parent_id ?? null)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const sort_order = (maxOrder?.sort_order ?? -1) + 1

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...project,
        color: project.color ?? '#283B56',
        sort_order,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async archiveProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ is_archived: true })
      .eq('id', id)

    if (error) throw error
  },

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
  },

  async reorderProjects(items: { id: string; sort_order: number }[]): Promise<void> {
    await Promise.all(
      items.map(({ id, sort_order }) =>
        supabase.from('projects').update({ sort_order }).eq('id', id),
      ),
    )
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ is_favorite: isFavorite })
      .eq('id', id)

    if (error) throw error
  },
}
