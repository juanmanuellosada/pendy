import { useEffect, useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'
import { Bold, Italic, Strikethrough, Link as LinkIcon } from 'lucide-react'
import { parseNLPTokens } from '@/services/dateParser'
import { LinkDialog } from '@/components/common/LinkDialog'
import { LinkBubble } from '@/components/common/LinkBubble'
import { BreakMarksOnSpace } from '@/lib/tiptapExtensions'

interface TitleEditorProps {
  content: string
  onChange: (html: string) => void
  onSubmit?: () => void
  onEscape?: () => void
  placeholder?: string
  autoFocus?: boolean
  editorRef?: React.MutableRefObject<Editor | null>
  onUpdate?: (editor: Editor) => void
  onKeyDown?: (event: KeyboardEvent, editor: Editor) => boolean
  className?: string
  textClassName?: string
  /** Content rendered to the left of the editor text (below toolbar). */
  leftSlot?: React.ReactNode
}

// Extension to block Enter/newlines and handle Escape
const SingleLine = Extension.create({
  name: 'singleLine',

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        // Will be handled by parent via onKeyDown prop
        return true
      },
      'Shift-Enter': () => true,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('singleLinePaste'),
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData('text/plain') ?? ''
            const clean = text.replace(/[\n\r]+/g, ' ').trim()
            if (clean !== text) {
              event.preventDefault()
              _view.dispatch(
                _view.state.tr.insertText(
                  clean,
                  _view.state.selection.from,
                  _view.state.selection.to,
                ),
              )
              return true
            }
            return false
          },
          handleDrop: () => true,
        },
      }),
    ]
  },
})

// NLP token highlighting via ProseMirror decorations (visual-only, doesn't modify doc)
const NLP_HIGHLIGHT_COLOR = '#8B5CF6'
const nlpHighlightKey = new PluginKey('nlpHighlight')

function computeNLPDecorations(state: EditorState): DecorationSet {
  // Build plain text + position map from doc
  let text = ''
  const posMap: number[] = []
  state.doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        posMap.push(pos + i)
      }
      text += node.text
    }
  })

  if (!text.trim()) return DecorationSet.empty

  const nlp = parseNLPTokens(text)
  if (nlp.patterns.length === 0) return DecorationSet.empty

  const decorations: Decoration[] = []
  const lower = text.toLowerCase()

  for (const pattern of nlp.patterns) {
    const m = lower.match(pattern)
    if (m && m.index !== undefined && m[0].length > 0) {
      const matchStart = m.index
      const matchEnd = matchStart + m[0].length
      if (matchStart < posMap.length && matchEnd - 1 < posMap.length) {
        const from = posMap[matchStart]!
        const to = posMap[matchEnd - 1]! + 1
        decorations.push(
          Decoration.inline(from, to, {
            style: `color: ${NLP_HIGHLIGHT_COLOR}`,
            class: 'nlp-token',
          }),
        )
      }
    }
  }

  // Tokens inline: p1-p4, #etiqueta, @proyecto
  const INLINE_TOKEN_PATTERNS = [/\bp[1-4]\b/g, /#\S+/g, /@\S+/g]
  for (const re of INLINE_TOKEN_PATTERNS) {
    const g = new RegExp(re.source, re.flags)
    let em: RegExpExecArray | null
    while ((em = g.exec(lower)) !== null) {
      const ms = em.index
      const me = ms + em[0].length
      if (ms < posMap.length && me - 1 < posMap.length) {
        const from = posMap[ms]!
        const to = posMap[me - 1]! + 1
        decorations.push(
          Decoration.inline(from, to, {
            style: `color: ${NLP_HIGHLIGHT_COLOR}`,
            class: 'nlp-token',
          }),
        )
      }
    }
  }

  if (decorations.length === 0) return DecorationSet.empty
  return DecorationSet.create(state.doc, decorations)
}

const NLPHighlight = Extension.create({
  name: 'nlpHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: nlpHighlightKey,
        state: {
          init(_, state) {
            return computeNLPDecorations(state)
          },
          apply(tr, oldDecorations, _, newState) {
            if (!tr.docChanged) return oldDecorations
            return computeNLPDecorations(newState)
          },
        },
        props: {
          decorations(state) {
            return nlpHighlightKey.getState(state)
          },
        },
      }),
    ]
  },
})

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
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      aria-label={label}
      title={label}
      aria-pressed={isActive}
      className="rounded p-2 md:p-1 text-sm transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
      style={{
        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
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

export function TitleEditor({
  content,
  onChange,
  onSubmit,
  onEscape,
  placeholder = 'Nombre de la tarea',
  autoFocus = false,
  editorRef,
  onUpdate,
  onKeyDown,
  className = '',
  textClassName = 'text-sm font-medium leading-normal',
  leftSlot,
}: TitleEditorProps) {
  const internalRef = useRef<Editor | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkInitialUrl, setLinkInitialUrl] = useState('')
  const [linkInitialText, setLinkInitialText] = useState<string | undefined>(undefined)
  const [linkEditRange, setLinkEditRange] = useState<{ from: number; to: number } | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        hardBreak: false,
        underline: false,
        // Link ya viene en StarterKit v3 — configurarlo aquí evita el duplicado
        link: { openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } },
      }),
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      SingleLine,
      NLPHighlight,
      BreakMarksOnSpace,
    ],
    content,
    autofocus: autoFocus,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())
      onUpdate?.(ed)
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        // Let parent handle keys first (e.g., ArrowUp/Down for autocomplete)
        if (onKeyDown) {
          const handled = onKeyDown(event, _view.state as unknown as Editor)
          if (handled) return true
        }
        if (event.key === 'Escape') {
          onEscape?.()
          return true
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          onSubmit?.()
          return true
        }
        return false
      },
    },
  })

  // Expose editor ref
  useEffect(() => {
    if (editor) {
      internalRef.current = editor
      if (editorRef) editorRef.current = editor
    }
    return () => {
      if (editorRef) editorRef.current = null
    }
  }, [editor, editorRef])

  // Sync content from parent (e.g., when editing an existing task)
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

  // Toolbar "insert new link"
  const openLinkDialog = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href ?? ''
    setLinkInitialUrl(previousUrl)
    setLinkInitialText(undefined)
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
          // Remove link
          editor.chain().focus().setTextSelection({ from, to }).unsetLink().run()
        } else {
          // Replace text node directly with new text + link mark
          const linkMark = editor.schema.marks.link!.create({ href: url })
          const newText = text && text !== '' ? text : editor.state.doc.textBetween(from, to)
          const tr = editor.state.tr.replaceWith(from, to, editor.schema.text(newText, [linkMark]))
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
      <div className={className}>
        {/* Toolbar */}
        <div className="mb-1 flex items-center gap-0.5">
          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleBold().run())}
            isActive={editor.isActive('bold')}
            label="Negrita"
          >
            <Bold size={13} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleItalic().run())}
            isActive={editor.isActive('italic')}
            label="Cursiva"
          >
            <Italic size={13} />
          </ToolbarButton>

          <ToolbarButton
            onClick={cmd(() => editor.chain().focus().toggleStrike().run())}
            isActive={editor.isActive('strike')}
            label="Tachado"
          >
            <Strikethrough size={13} />
          </ToolbarButton>

          <ToolbarButton onClick={openLinkDialog} isActive={editor.isActive('link')} label="Enlace">
            <LinkIcon size={13} />
          </ToolbarButton>
        </div>

        {/* Editor */}
        <div className="flex items-start gap-3">
          {leftSlot}
          <EditorContent
            editor={editor}
            className={`tiptap-title flex-1 ${textClassName} [&_.tiptap]:outline-none`}
            style={{ color: 'var(--text-primary)' }}
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
