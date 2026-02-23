import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Strikethrough, List, ListOrdered } from 'lucide-react'

interface MarkdownEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

function ToolbarButton({
  onClick,
  isActive,
  label,
  children,
}: {
  onClick: () => void
  isActive: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      className="rounded p-1.5 text-sm transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = isActive ? 'var(--bg-hover)' : 'transparent')
      }
    >
      {children}
    </button>
  )
}

export function MarkdownEditor({
  content,
  onChange,
  placeholder = 'Agregar descripción...',
  minHeight = 80,
}: MarkdownEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Deshabilitamos todo excepto lo que queremos
        code: false,
        codeBlock: false,
        blockquote: false,
        heading: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  const cmd = useCallback(
    (fn: () => void) => () => {
      fn()
      editor?.commands.focus()
    },
    [editor],
  )

  if (!editor) return null

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 border-b px-2 py-1"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleBold().run())}
          isActive={editor.isActive('bold')}
          label="Negrita"
        >
          <Bold size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleItalic().run())}
          isActive={editor.isActive('italic')}
          label="Cursiva"
        >
          <Italic size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleStrike().run())}
          isActive={editor.isActive('strike')}
          label="Tachado"
        >
          <Strikethrough size={14} />
        </ToolbarButton>

        <div className="mx-1 h-4 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleBulletList().run())}
          isActive={editor.isActive('bulletList')}
          label="Lista con viñetas"
        >
          <List size={14} />
        </ToolbarButton>

        <ToolbarButton
          onClick={cmd(() => editor.chain().focus().toggleOrderedList().run())}
          isActive={editor.isActive('orderedList')}
          label="Lista numerada"
        >
          <ListOrdered size={14} />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent
        editor={editor}
        className="px-3 py-2 text-sm [&_.tiptap]:outline-none [&_.tiptap]:focus:outline-none"
        style={{ minHeight, color: 'var(--text-primary)' }}
      />
    </div>
  )
}
