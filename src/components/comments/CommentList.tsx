import { useState } from 'react'
import { Pencil, Trash2, MessageSquare } from 'lucide-react'
import { useComments, useDeleteComment } from '@/hooks/useComments'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/uiStore'
import { CommentEditor } from './CommentEditor'
import { formatRelativeDate } from '@/lib/utils'
import DOMPurify from 'dompurify'

interface CommentListProps {
  taskId: string
}

export function CommentList({ taskId }: CommentListProps) {
  const { data: comments = [], isLoading } = useComments(taskId)
  const deleteComment = useDeleteComment()
  const { showConfirmDialog } = useUIStore()
  const { profile } = useAuth()
  const [editingId, setEditingId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    showConfirmDialog({
      title: 'Eliminar comentario',
      message: '¿Eliminar este comentario? Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: () => deleteComment.mutate({ id, taskId }),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <MessageSquare size={15} style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Comentarios
        </span>
        {comments.length > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ({comments.length})
          </span>
        )}
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="mb-3 space-y-3">
          {comments.map((comment) =>
            editingId === comment.id ? (
              <CommentEditor
                key={comment.id}
                taskId={taskId}
                comment={comment}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <div
                key={comment.id}
                className="group rounded-lg border p-3"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                {/* Meta */}
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {profile?.full_name || 'Usuario'} · {formatRelativeDate(comment.created_at)}
                    {comment.updated_at !== comment.created_at && ' (editado)'}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingId(comment.id)}
                      className="rounded p-1 transition-colors hover:opacity-70"
                      style={{ color: 'var(--text-muted)' }}
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="rounded p-1 transition-colors hover:opacity-70"
                      style={{ color: '#EC1E2A' }}
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div
                  className="prose-compact text-sm leading-relaxed"
                  style={{ color: 'var(--text-primary)' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comment.content) }}
                />
              </div>
            ),
          )}
        </div>
      )}

      {/* New comment */}
      {editingId !== 'new' ? (
        <button
          onClick={() => setEditingId('new')}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <MessageSquare size={14} />
          Agregar comentario
        </button>
      ) : (
        <CommentEditor taskId={taskId} onDone={() => setEditingId(null)} />
      )}
    </div>
  )
}
