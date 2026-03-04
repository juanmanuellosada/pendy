import { supabase } from '@/lib/supabase'
import type { Comment } from '@/lib/types'

export const commentService = {
  async getComments(taskId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data ?? []
  },

  async createComment(comment: {
    user_id: string
    task_id: string
    content: string
  }): Promise<Comment> {
    const { data, error } = await supabase.from('comments').insert(comment).select().single()

    if (error) throw error
    return data
  },

  async updateComment(id: string, content: string): Promise<Comment> {
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteComment(id: string): Promise<void> {
    const { error } = await supabase.from('comments').delete().eq('id', id)
    if (error) throw error
  },
}
