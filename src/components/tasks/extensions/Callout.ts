import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PmNode, NodeType } from '@tiptap/pm/model'

type CalloutType = 'info' | 'warning' | 'danger' | 'tip' | 'note'

const CALLOUT_TYPE_RE = /^\[!(info|warning|danger|tip|note)\]\s*(.*)/i

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs: { type: CalloutType; title?: string }) => ReturnType
      toggleCallout: (attrs: { type: CalloutType }) => ReturnType
      unsetCallout: () => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (el) => (el as HTMLElement).dataset.calloutType ?? 'info',
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type as string }),
      },
      title: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).dataset.calloutTitle ?? '',
        renderHTML: (attrs) => ({
          'data-callout-title': (attrs.title as string | undefined) ?? '',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const type: CalloutType = (node.attrs.type as CalloutType | undefined) ?? 'info'
    const title: string = (node.attrs.title as string | undefined) ?? ''

    const titleEl: [
      'div',
      Record<string, string>,
      ...Array<['span', Record<string, string>] | ['span', Record<string, string>, string]>,
    ] = [
      'div',
      { class: 'callout-title', contenteditable: 'false' },
      ['span', { class: 'callout-icon', 'aria-hidden': 'true' }],
      ['span', { class: 'callout-label' }, title],
    ]

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${type}`,
        'data-callout': '',
      }),
      titleEl,
      ['div', { class: 'callout-content' }, 0],
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs)
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name)
        },
    }
  },

  addProseMirrorPlugins() {
    const nodeType: NodeType = this.type

    return [
      new Plugin({
        key: new PluginKey('calloutPaste'),
        appendTransaction(transactions, _oldState, newState) {
          // Only run when the doc actually changed (paste, input, etc.)
          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) return null

          const tr = newState.tr
          let changed = false

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'blockquote') return

            // Check if the first child is a paragraph whose text starts with [!type]
            const firstChild = node.firstChild
            if (!firstChild || firstChild.type.name !== 'paragraph') return

            const firstText = firstChild.textContent
            const match = CALLOUT_TYPE_RE.exec(firstText)
            if (!match || match[1] == null) return

            const calloutType = match[1].toLowerCase() as CalloutType
            const calloutTitle = (match[2] ?? '').trim()

            // Collect content nodes, skipping the first paragraph (the [!type] header)
            const contentNodes: PmNode[] = []
            node.forEach((child, _offset, index) => {
              if (index === 0) return // skip first paragraph ([!type] header)
              contentNodes.push(child)
            })

            // If no remaining content, add an empty paragraph
            if (contentNodes.length === 0) {
              const emptyPara = newState.schema.nodes['paragraph']
              if (emptyPara) contentNodes.push(emptyPara.create())
            }

            const calloutNode = nodeType.create(
              { type: calloutType, title: calloutTitle },
              contentNodes,
            )

            tr.replaceWith(pos, pos + node.nodeSize, calloutNode)
            changed = true
            // Don't descend into the replaced node
            return false
          })

          return changed ? tr : null
        },
      }),
    ]
  },
})
