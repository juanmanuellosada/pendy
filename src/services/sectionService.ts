import { supabase } from '@/lib/supabase'
import type { Section } from '@/lib/types'

export const sectionService = {
  async getSectionsByProject(projectId: string): Promise<Section[]> {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async getAllSections(): Promise<Section[]> {
    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createSection(section: {
    user_id: string
    project_id: string
    name: string
  }): Promise<Section> {
    const { data: maxOrder } = await supabase
      .from('sections')
      .select('sort_order')
      .eq('project_id', section.project_id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('sections')
      .insert({ ...section, sort_order: (maxOrder?.sort_order ?? -1) + 1 })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateSection(
    id: string,
    updates: Partial<Pick<Section, 'name' | 'collapsed' | 'sort_order'>>,
  ): Promise<Section> {
    const { data, error } = await supabase
      .from('sections')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async reorderSections(updates: { id: string; sort_order: number }[]): Promise<void> {
    const results = await Promise.all(
      updates.map(({ id, sort_order }) =>
        supabase.from('sections').update({ sort_order }).eq('id', id),
      ),
    )
    const error = results.find((r) => r.error)?.error
    if (error) throw error
  },

  async deleteSection(id: string): Promise<void> {
    const { error } = await supabase.from('sections').delete().eq('id', id)
    if (error) throw error
  },
}
