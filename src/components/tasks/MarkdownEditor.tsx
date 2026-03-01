import { useEffect, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Markdown } from 'tiptap-markdown'
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  FileCode,
  Minus,
  Link as LinkIcon,
  Highlighter,
  Undo2,
  Redo2,
} from 'lucide-react'
import { LinkDialog } from '@/components/common/LinkDialog'
import { LinkBubble } from '@/components/common/LinkBubble'
import { BreakMarksOnSpace, NormalizeCheckboxPaste } from '@/lib/tiptapExtensions'

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
  disabled = false,
}: {
  onClick: () => void
  isActive: boolean
  label: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      disabled={disabled}
      className="rounded p-1.5 text-sm transition-colors disabled:opacity-30"
      style={{
        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        if (!disabled)
          e.currentTarget.style.backgroundColor = isActive ? 'var(--bg-hover)' : 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Separator() {
  return <div className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
}

/* ── Main Editor ─────────────────────────────────────── */
export function MarkdownEditor({
  content,
  onChange,
  placeholder = 'Agregar descripción...',
  minHeight = 80,
}: MarkdownEditorProps) {
  // Force re-render on selection change so toolbar buttons reflect active formats
  const [, setTick] = useState(0)

  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkInitialUrl, setLinkInitialUrl] = useState('')
  const [linkInitialText, setLinkInitialText] = useState<string | undefined>(undefined)
  const [linkEditRange, setLinkEditRange] = useState<{ from: number; to: number } | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        code: {},
        codeBlock: {},
        blockquote: {},
        horizontalRule: {},
        bulletList: {},
        orderedList: {},
        listItem: {},
        bold: {},
        italic: {},
        strike: {},
        hardBreak: {},
        // Link y Underline vienen en StarterKit v3 — configurarlos aquí evita duplicados
        link: { openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: false,
      }),
      BreakMarksOnSpace,
      NormalizeCheckboxPaste,
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
    },
  })

  // Re-render toolbar when selection changes so active state updates
  useEffect(() => {
    if (!editor) return
    const onSelectionUpdate = () => setTick((n) => n + 1)
    editor.on('selectionUpdate', onSelectionUpdate)
    return () => { editor.off('selectionUpdate', onSelectionUpdate) }
  }, [editor])

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

  // Toolbar "insert new link" (no text field)
  const openLinkDialog = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href ?? ''
    setLinkInitialUrl(previousUrl)
    setLinkInitialText(undefined) // no text field when inserting from toolbar
    setLinkDialogOpen(true)
  }, [editor])

  // Bubble "edit existing link" (with text field)
  const openLinkEdit = useCallback(
    (url: string, text: string) => {
      if (!editor) return

      // Find the link's exact range in the document
      let range: { from: number; to: number } | null = null
      editor.state.doc.descendants((node, pos) => {
        if (range) return false
        if (node.isText && node.marks.some((m) => m.type.name === 'link' && m.attrs.href === url)) {
          range = { from: pos, to: pos + node.nodeSize }
          return false
        }
      })

      setLinkEditRange(range)
      setLinkInitialUrl(url)
      setLinkInitialText(text)
      setLinkDialogOpen(true)
    },
    [editor],
  )

  const handleLinkSubmit = useCallback(
    (url: string, text?: string) => {
      if (!editor) return
      setLinkDialogOpen(false)

      // Editing existing link via bubble (we have saved range)
      if (linkEditRange) {
        const { from, to } = linkEditRange

        if (url === '') {
          editor.chain().focus().setTextSelection({ from, to }).unsetLink().run()
        } else {
          const linkMark = editor.schema.marks.link!.create({ href: url })
          const newText = text && text !== '' ? text : editor.state.doc.textBetween(from, to)
          const tr = editor.state.tr.replaceWith(
            from,
            to,
            editor.schema.text(newText, [linkMark]),
          )
          editor.view.dispatch(tr)
        }

        setLinkEditRange(null)
        return
      }

      // New link from toolbar
      if (url === '') {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }
    },
    [editor, linkEditRange],
  )

  if (!editor) return null

  return (
    <>
      <div
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Toolbar */}
        <div
          className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          {/* Text formatting */}
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
            onClick={cmd(() => editor.chain().focus().toggleUnderline().run())}
            isActive={editor.isActive('underline')}
            label="Subrayado"
          >
            <UnderlineIcon size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleStrike().run())}
            isActive={editor.isActive('strike')}
            label="Tachado"
          >
            <Strikethrough size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleHighlight().run())}
            isActive={editor.isActive('highlight')}
            label="Resaltar"
          >
            <Highlighter size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleCode().run())}
            isActive={editor.isActive('code')}
            label="Código inline"
          >
            <Code size={14} />
          </ToolbarButton>

          <Separator />

          {/* Headings */}
          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
            isActive={editor.isActive('heading', { level: 1 })}
            label="Título 1"
          >
            <Heading1 size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
            isActive={editor.isActive('heading', { level: 2 })}
            label="Título 2"
          >
            <Heading2 size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
            isActive={editor.isActive('heading', { level: 3 })}
            label="Título 3"
          >
            <Heading3 size={14} />
          </ToolbarButton>

          <Separator />

          {/* Lists */}
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

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleTaskList().run())}
            isActive={editor.isActive('taskList')}
            label="Lista de tareas"
          >
            <ListChecks size={14} />
          </ToolbarButton>

          <Separator />

          {/* Block elements */}
          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleBlockquote().run())}
            isActive={editor.isActive('blockquote')}
            label="Cita"
          >
            <Quote size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleCodeBlock().run())}
            isActive={editor.isActive('codeBlock')}
            label="Bloque de código"
          >
            <FileCode size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().setHorizontalRule().run())}
            isActive={false}
            label="Línea horizontal"
          >
            <Minus size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={openLinkDialog}
            isActive={editor.isActive('link')}
            label="Enlace"
          >
            <LinkIcon size={14} />
          </ToolbarButton>

          <Separator />

          {/* Undo / Redo */}
          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().undo().run())}
            isActive={false}
            disabled={!editor.can().undo()}
            label="Deshacer"
          >
            <Undo2 size={14} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().redo().run())}
            isActive={false}
            disabled={!editor.can().redo()}
            label="Rehacer"
          >
            <Redo2 size={14} />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
          <EditorContent
            editor={editor}
            className="tiptap-description px-3 py-2 text-sm [&_.tiptap]:outline-none [&_.tiptap]:focus:outline-none"
            style={{ minHeight, color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Link hover bubble */}
      <LinkBubble editor={editor} onEdit={openLinkEdit} />

      {/* Link Dialog */}
      <LinkDialog
        open={linkDialogOpen}
        initialUrl={linkInitialUrl}
        initialText={linkInitialText}
        onSubmit={handleLinkSubmit}
        onClose={() => {
          setLinkDialogOpen(false)
          editor?.commands.focus()
        }}
      />
    </>
  )
}
