import { useState } from 'react'
import { MarkdownEditor } from '@/components/tasks/MarkdownEditor'
import { useCreateComment, useUpdateComment } from '@/hooks/useComments'
import type { Comment } from '@/lib/types'

interface CommentEditorProps {
  taskId: string
  comment?: Comment
  onDone: () => void
}

export function CommentEditor({ taskId, comment, onDone }: CommentEditorProps) {
  const [content, setContent] = useState(comment?.content ?? '')
  const createComment = useCreateComment()
  const updateComment = useUpdateComment()

  const isEditing = !!comment
  const isPending = createComment.isPending || updateComment.isPending

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || trimmed === '<p></p>') return

    if (isEditing) {
      await updateComment.mutateAsync({ id: comment.id, content: trimmed, taskId })
    } else {
      await createComment.mutateAsync({ taskId, content: trimmed })
    }
    setContent('')
    onDone()
  }

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-primary)' }}>
      <MarkdownEditor
        content={content}
        onChange={setContent}
        placeholder="Escribe un comentario..."
        minHeight={60}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || content.trim() === '<p></p>' || isPending}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: '#283B56' }}
        >
          {isEditing ? 'Guardar' : 'Comentar'}
        </button>
      </div>
    </div>
  )
}
