import { useEffect, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, ExternalLink } from 'lucide-react'
import type { Editor } from '@tiptap/react'

interface BubbleState {
  url: string
  text: string
  top: number
  left: number
}

interface LinkBubbleProps {
  editor: Editor
  onEdit: (url: string, text: string) => void
}

export function LinkBubble({ editor, onEdit }: LinkBubbleProps) {
  const [bubble, setBubble] = useState<BubbleState | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const hideTimeout = useRef<number>(0)

  const show = useCallback((linkEl: HTMLElement) => {
    clearTimeout(hideTimeout.current)
    const rect = linkEl.getBoundingClientRect()
    setBubble({
      url: linkEl.getAttribute('href') || '',
      text: linkEl.textContent || '',
      top: rect.bottom + 4,
      left: rect.left,
    })
  }, [])

  const hide = useCallback(() => {
    hideTimeout.current = window.setTimeout(() => setBubble(null), 200)
  }, [])

  const keepVisible = useCallback(() => {
    clearTimeout(hideTimeout.current)
  }, [])

  // Hover detection on links inside the editor
  useEffect(() => {
    const dom = editor.view.dom

    const onOver = (e: Event) => {
      const target = (e.target as HTMLElement).closest('a')
      if (target && dom.contains(target)) show(target as HTMLElement)
    }

    const onOut = (e: Event) => {
      const me = e as MouseEvent
      const related = me.relatedTarget as HTMLElement | null
      // Don't hide if moving into the bubble itself
      if (related && bubbleRef.current?.contains(related)) return
      const target = (e.target as HTMLElement).closest('a')
      if (target) hide()
    }

    dom.addEventListener('mouseover', onOver)
    dom.addEventListener('mouseout', onOut)

    return () => {
      dom.removeEventListener('mouseover', onOver)
      dom.removeEventListener('mouseout', onOut)
      clearTimeout(hideTimeout.current)
    }
  }, [editor, show, hide])

  // Also show when cursor is placed inside a link (keyboard / click)
  useEffect(() => {
    const onSelectionUpdate = () => {
      if (!editor.isActive('link')) {
        // Only hide if not hovering
        if (!bubbleRef.current?.matches(':hover')) {
          setBubble(null)
        }
        return
      }
      // Find the link DOM node at cursor
      const { from } = editor.state.selection
      const domAtPos = editor.view.domAtPos(from)
      const node =
        domAtPos.node instanceof HTMLElement ? domAtPos.node : domAtPos.node.parentElement
      const linkEl = node?.closest('a')
      if (linkEl) show(linkEl as HTMLElement)
    }

    editor.on('selectionUpdate', onSelectionUpdate)
    return () => {
      editor.off('selectionUpdate', onSelectionUpdate)
    }
  }, [editor, show])

  const handleEdit = useCallback(() => {
    if (!bubble) return
    setBubble(null)
    onEdit(bubble.url, bubble.text)
  }, [bubble, onEdit])

  const handleRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setBubble(null)
  }, [editor])

  const handleOpen = useCallback(() => {
    if (bubble?.url) window.open(bubble.url, '_blank', 'noopener')
  }, [bubble])

  if (!bubble) return null

  // Clamp position so it doesn't overflow screen
  const left = Math.max(8, Math.min(bubble.left, window.innerWidth - 320))
  const top = Math.min(bubble.top, window.innerHeight - 60)

  return createPortal(
    <div
      ref={bubbleRef}
      className="animate-fade-in"
      style={{ position: 'fixed', top, left, zIndex: 60 }}
      onMouseEnter={keepVisible}
      onMouseLeave={hide}
    >
      <div
        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 shadow-md"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {/* URL display */}
        <span
          className="max-w-[200px] truncate text-xs"
          style={{ color: '#3B82F6' }}
          title={bubble.url}
        >
          {bubble.url}
        </span>

        <div className="mx-0.5 h-3.5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />

        {/* Open */}
        <button
          type="button"
          onClick={handleOpen}
          title="Abrir enlace"
          className="rounded p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ExternalLink size={13} />
        </button>

        {/* Edit */}
        <button
          type="button"
          onClick={handleEdit}
          title="Editar enlace"
          className="rounded p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Pencil size={13} />
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={handleRemove}
          title="Quitar enlace"
          className="rounded p-1 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
            e.currentTarget.style.color = '#EC1E2A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
