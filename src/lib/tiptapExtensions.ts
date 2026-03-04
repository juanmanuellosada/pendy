import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { Slice } from '@tiptap/pm/model'

/**
 * Normalizes pasted text so checkboxes are always valid markdown task lists:
 *  - Bare "[ ] text"  → "- [ ] text"   (adds list prefix)
 *  - "- [ ]"  (empty) → "- [ ] \u200B" (adds content so parser recognises it)
 */
export const NormalizeCheckboxPaste = Extension.create({
  name: 'normalizeCheckboxPaste',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('normalizeCheckboxPaste'),
        props: {
          handlePaste(view: EditorView, event: ClipboardEvent) {
            const text = event.clipboardData?.getData('text/plain')
            if (!text) return false

            // Quick check: does the text contain any checkbox pattern?
            if (!/\[[ xX]\]/.test(text)) return false

            let normalized = text

            // Step 1: Add "- " prefix to bare checkboxes (no list marker)
            normalized = normalized.replace(
              /^(\s*)\[( |x|X)\](\s*)(.*)/gm,
              (match, indent: string, check: string, _sp: string, content: string) => {
                if (/^\s*[-*+]\s/.test(match)) return match
                return `${indent}- [${check}] ${content || '\u200B'}`
              },
            )

            // Step 2: Ensure all task items have content after [ ]
            // markdown-it requires at least a space + char after the brackets
            normalized = normalized.replace(/^(\s*[-*+]\s+\[[ xX]\])\s*$/gm, '$1 \u200B')

            // If nothing changed, let default handling take over
            if (normalized === text) return false

            // Use tiptap-markdown's clipboardTextParser to parse the normalized markdown
            const $context = view.state.selection.$from
            type ResolvedPos = typeof $context
            type ClipboardTextParser = (
              text: string,
              $context: ResolvedPos,
              plain: boolean,
              view: EditorView,
            ) => Slice
            const slice = (
              view as unknown as {
                someProp: (
                  name: string,
                  f: (p: ClipboardTextParser) => Slice | undefined,
                ) => Slice | undefined
              }
            ).someProp('clipboardTextParser', (parser) => parser(normalized, $context, false, view))

            if (slice) {
              view.dispatch(view.state.tr.replaceSelection(slice))
              return true
            }

            return false
          },
        },
      }),
    ]
  },
})

/**
 * Clears all active inline marks (bold, italic, link, etc.)
 * after the user types a space, so the next word is plain text.
 */
export const BreakMarksOnSpace = Extension.create({
  name: 'breakMarksOnSpace',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('breakMarksOnSpace'),
        props: {
          handleKeyDown(view, event) {
            if (event.key !== ' ' || event.ctrlKey || event.metaKey || event.altKey) return false

            const { state } = view
            const { selection } = state
            const marks = state.storedMarks ?? selection.$from.marks()

            if (marks.length === 0) return false

            // Insert space keeping current marks, then clear stored marks
            const { from, to } = selection
            const tr = state.tr.insertText(' ', from, to)
            tr.setStoredMarks([])
            view.dispatch(tr)
            return true
          },
        },
      }),
    ]
  },
})
