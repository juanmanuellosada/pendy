import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, X, Check, Plus, Trash2, Pencil, Flag, Tag } from 'lucide-react'
import { ColorPicker } from '@/components/common/ColorPicker'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useProjects, useInboxProject, useCreateProject, useUpdateProject, useDeleteProject } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useLabels, useTaskLabels, useCreateLabel, useDeleteLabel, useUpdateLabel, LABEL_COLORS } from '@/hooks/useLabels'
import { useCreateReminder } from '@/hooks/useReminders'
import { useUIStore } from '@/stores/uiStore'
import { PRIORITY_COLORS, PRIORITY_LABELS, PROJECT_COLORS } from '@/lib/constants'
import { cn, stripHtmlTags } from '@/lib/utils'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { DeadlinePicker } from '@/components/common/DeadlinePicker'
import { ReminderPicker, resolveReminderConfig } from '@/components/common/ReminderPicker'
import type { ReminderConfig } from '@/components/common/ReminderPicker'
import { parseNLPTokens, stripNLPTokens } from '@/services/dateParser'
import { MarkdownEditor } from './MarkdownEditor'
import { TitleEditor } from './TitleEditor'
import type { Editor } from '@tiptap/react'
import type { Task } from '@/lib/types'

interface TaskEditorProps {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultProjectId?: string
  defaultDate?: string | null
  defaultTime?: string | null
  defaultDurationMinutes?: number | null
  defaultSectionId?: string | null
  inline?: boolean
}

export function TaskEditor({ open, onClose, task, defaultProjectId, defaultDate, defaultTime, defaultDurationMinutes, defaultSectionId, inline }: TaskEditorProps) {
  const { user } = useAuth()
  const { data: projects = [] } = useProjects()
  const { data: inboxProject } = useInboxProject()
  const { data: labels = [] } = useLabels()
  const { data: existingLabels = [] } = useTaskLabels(task?.id ?? '')
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const createReminder = useCreateReminder()
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const { showConfirmDialog } = useUIStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(4)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [dueTime, setDueTime] = useState<string | null>(null)
  const [hasTime, setHasTime] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [recurrenceFrom, setRecurrenceFrom] = useState<'due_date' | 'completion_date'>('due_date')
  const [deadline, setDeadline] = useState<string | null>(null)
  const [pendingReminders, setPendingReminders] = useState<ReminderConfig[]>([])
  const [projectId, setProjectId] = useState('')
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([])
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [labelSearch, setLabelSearch] = useState('')
  const [hoveredLabelId, setHoveredLabelId] = useState<string | null>(null)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelName, setEditingLabelName] = useState('')
  const [editingLabelColor, setEditingLabelColor] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [editingProjectColor, setEditingProjectColor] = useState('')

  // Hash autocomplete state (#labels)
  const [hashQuery, setHashQuery] = useState<string | null>(null)
  const [hashStart, setHashStart] = useState(0)
  const [hashHighlightIdx, setHashHighlightIdx] = useState(0)
  // At autocomplete state (@projects)
  const [atQuery, setAtQuery] = useState<string | null>(null)
  const [atStart, setAtStart] = useState(0)
  const [atHighlightIdx, setAtHighlightIdx] = useState(0)
  const titleEditorRef = useRef<Editor | null>(null)
  // Track which fields were set by live NLP so we can clear them when the token is removed
  const nlpAppliedRef = useRef({ date: false, time: false, duration: false, recurrence: false })

  useEffect(() => {
    if (!open) return

    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setDueDate(task.due_date ?? null)
      setHasTime(task.has_time)
      setDurationMinutes(task.duration_minutes)
      setIsRecurring(task.is_recurring)
      setRecurrenceRule(task.recurrence_rule ?? null)
      setRecurrenceFrom(task.recurrence_from ?? 'due_date')
      setDeadline(task.deadline ?? null)
      setProjectId(task.project_id)
      if (task.has_time && task.due_datetime) {
        const d = new Date(task.due_datetime)
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setDueTime(`${hh}:${mm}`)
      } else {
        setDueTime(null)
      }
      setSelectedLabelIds(existingLabels.map((l) => l.id))
      setPendingReminders([])
    } else {
      setTitle('')
      setDescription('')
      setPriority(4)
      setDueDate(defaultDate ?? null)
      setDueTime(defaultTime ?? null)
      setHasTime(!!defaultTime)
      setDurationMinutes(defaultDurationMinutes ?? null)
      setIsRecurring(false)
      setRecurrenceRule(null)
      setRecurrenceFrom('due_date')
      setDeadline(null)
      setPendingReminders([])
      setProjectId(defaultProjectId ?? inboxProject?.id ?? '')
      setSelectedLabelIds([])
    }
    setHashQuery(null)
    setAtQuery(null)
    nlpAppliedRef.current = { date: false, time: false, duration: false, recurrence: false }
  }, [task, open, defaultProjectId, defaultDate, defaultTime, defaultDurationMinutes, inboxProject, existingLabels.length])

  // â”€â”€ Helper: remove a #labelname token from HTML via DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removeLabelToken = useCallback((html: string, labelName: string) => {
    const escaped = labelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const div = document.createElement('div')
    div.innerHTML = html
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? ''
      const cleaned = text
        .replace(new RegExp(`#${escaped}(?=\\s|$)`, 'gi'), '')
        .replace(/\s+/g, ' ')
      node.textContent = cleaned
    }
    return div.innerHTML
  }, [])

  // â”€â”€ Helper: remove a @projectname token from HTML via DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removeProjectToken = useCallback((html: string, projectName: string) => {
    const escaped = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const div = document.createElement('div')
    div.innerHTML = html
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? ''
      const cleaned = text
        .replace(new RegExp(`@${escaped}(?=\\s|$)`, 'gi'), '')
        .replace(/\s+/g, ' ')
      node.textContent = cleaned
    }
    return div.innerHTML
  }, [])

  // â”€â”€ Helper: remove p1-p4 priority tokens from HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removePriorityTokens = useCallback((html: string) => {
    const div = document.createElement('div')
    div.innerHTML = html
    // Remove colored spans containing only a priority token
    div.querySelectorAll('span[style*="color"]').forEach((span) => {
      if (/^p[1-4]$/i.test(span.textContent?.trim() ?? '')) span.remove()
    })
    // Clean any remaining plain text priority tokens
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? ''
      const cleaned = text.replace(/(?:^| )p[1-4](?= |$)/gi, '').replace(/\s+/g, ' ')
      if (cleaned !== text) node.textContent = cleaned
    }
    return div.innerHTML
  }, [])

  // â”€â”€ Confirm a project from at autocomplete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const confirmAtProject = (project: { id: string; name: string; color: string }) => {
    const editor = titleEditorRef.current
    if (!editor) return
    const plainText = editor.getText()
    const token = '@' + project.name
    const before = plainText.slice(0, atStart)
    const after = plainText.slice(atStart + 1 + (atQuery?.length ?? 0))
    const newPlainTitle = (before + token + ' ' + after.trimStart()).trimEnd()
    const doc = editor.state.doc
    let textSeen = 0
    let fromPos = 0
    let toPos = 0
    const atEnd = atStart + 1 + (atQuery?.length ?? 0)
    doc.descendants((node, nodePos) => {
      if (node.isText) {
        const nodeStart = textSeen
        const nodeEnd = textSeen + node.text!.length
        if (fromPos === 0 && atStart >= nodeStart && atStart < nodeEnd) {
          fromPos = nodePos + (atStart - nodeStart)
        }
        if (toPos === 0 && atEnd >= nodeStart && atEnd <= nodeEnd) {
          toPos = nodePos + (atEnd - nodeStart)
        }
        textSeen = nodeEnd
      }
      return fromPos === 0 || toPos === 0
    })
    if (fromPos && toPos) {
      // Insert colored token via Tiptap content with marks
      editor.chain().focus()
        .deleteRange({ from: fromPos, to: toPos })
        .insertContentAt(fromPos, [
          { type: 'text', text: token, marks: [{ type: 'textStyle', attrs: { color: project.color } }] },
          { type: 'text', text: ' ' },
        ])
        .run()
    } else {
      editor.commands.setContent(newPlainTitle)
    }
    setProjectId(project.id)
    setAtQuery(null)
  }

  // â”€â”€ Confirm a label from hash autocomplete â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const confirmHashLabel = (label: { id: string; name: string; color: string }) => {
    const editor = titleEditorRef.current
    if (!editor) return
    const plainText = editor.getText()
    const token = '#' + label.name
    // Replace the hash query in the plain text
    const before = plainText.slice(0, hashStart)
    const after = plainText.slice(hashStart + 1 + (hashQuery?.length ?? 0))
    const afterTrimmed = after.trimStart()
    const newPlainTitle = (before + token + (afterTrimmed ? ' ' + afterTrimmed : '')).trimEnd()
    // We need to replace the content preserving formatting around the hash
    // Since hash tokens are typed inline (plain text), we can use setContent
    // but we'd lose formatting. Instead, use editor transactions.
    // Find the hash position in the ProseMirror doc
    const doc = editor.state.doc
    let textSeen = 0
    let fromPos = 0
    let toPos = 0
    const hashEnd = hashStart + 1 + (hashQuery?.length ?? 0)
    doc.descendants((node, nodePos) => {
      if (node.isText) {
        const nodeStart = textSeen
        const nodeEnd = textSeen + node.text!.length
        if (fromPos === 0 && hashStart >= nodeStart && hashStart < nodeEnd) {
          fromPos = nodePos + (hashStart - nodeStart)
        }
        if (toPos === 0 && hashEnd >= nodeStart && hashEnd <= nodeEnd) {
          toPos = nodePos + (hashEnd - nodeStart)
        }
        textSeen = nodeEnd
      }
      return fromPos === 0 || toPos === 0
    })
    if (fromPos && toPos) {
      editor.chain().focus()
        .deleteRange({ from: fromPos, to: toPos })
        .insertContentAt(fromPos, [
          { type: 'text', text: token, marks: [{ type: 'textStyle', attrs: { color: label.color } }] },
          { type: 'text', text: ' ' },
        ])
        .run()
    } else {
      editor.commands.setContent(newPlainTitle)
    }
    setSelectedLabelIds((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]))
    setHashQuery(null)
  }

  // â”€â”€ Create new label from hash query and confirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createAndConfirmHash = async (name: string) => {
    const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]
    const newLabel = await createLabel.mutateAsync({ name, color })
    confirmHashLabel(newLabel)
  }

  // â”€â”€ Handle title update from Tiptap with hash/at detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleTitleUpdate = useCallback((editor: Editor) => {
    const plainText = editor.getText()
    const { anchor } = editor.state.selection
    const textBeforeCursor = editor.state.doc.textBetween(0, anchor, '')
    const cursor = textBeforeCursor.length

    let hashIdx = -1
    let atIdx = -1
    for (let i = cursor - 1; i >= 0; i--) {
      if (plainText[i] === '#') {
        if (i === 0 || plainText[i - 1] === ' ') hashIdx = i
        break
      }
      if (plainText[i] === '@') {
        if (i === 0 || plainText[i - 1] === ' ') atIdx = i
        break
      }
      if (plainText[i] === ' ') break
    }

    if (hashIdx !== -1) {
      const query = plainText.slice(hashIdx + 1, cursor)
      if (!query.includes(' ')) {
        setHashQuery(query)
        setHashStart(hashIdx)
        setHashHighlightIdx(0)
        setAtQuery(null)
        return
      }
    }
    setHashQuery(null)

    if (atIdx !== -1) {
      const query = plainText.slice(atIdx + 1, cursor)
      if (!query.includes(' ')) {
        setAtQuery(query)
        setAtStart(atIdx)
        setAtHighlightIdx(0)
        return
      }
    }
    setAtQuery(null)
  }, [])

  // â”€â”€ Live NLP: runs on every title change via React state (not Tiptap callback)
  useEffect(() => {
    if (!open) return
    const plainText = stripHtmlTags(title)
    const nlp = parseNLPTokens(plainText)
    const applied = nlpAppliedRef.current

    if (nlp.date !== null) {
      setDueDate(nlp.date)
      applied.date = true
    } else if (applied.date) {
      setDueDate(null)
      applied.date = false
    }

    if (nlp.hasTime && nlp.time) {
      setDueTime(nlp.time)
      setHasTime(true)
      applied.time = true
    } else if (applied.time) {
      setDueTime(null)
      setHasTime(false)
      applied.time = false
    }

    if (nlp.durationMinutes !== null) {
      setDurationMinutes(nlp.durationMinutes)
      applied.duration = true
    } else if (applied.duration) {
      setDurationMinutes(null)
      applied.duration = false
    }

    if (nlp.isRecurring && nlp.recurrenceRule) {
      setIsRecurring(true)
      setRecurrenceRule(nlp.recurrenceRule)
      applied.recurrence = true
    } else if (applied.recurrence) {
      setIsRecurring(false)
      setRecurrenceRule(null)
      applied.recurrence = false
    }
  }, [title, open])

  // â”€â”€ Toggle label with bidirectional title sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleLabel = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId)
    if (!label) return
    const isSelected = selectedLabelIds.includes(labelId)
    if (isSelected) {
      setSelectedLabelIds((prev) => prev.filter((id) => id !== labelId))
      setTitle((prev) => removeLabelToken(prev, label.name))
    } else {
      setSelectedLabelIds((prev) => [...prev, labelId])
      // Only append if #labelname not already present in title plain text
      const escaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const plainText = stripHtmlTags(title)
      const alreadyInTitle = new RegExp(`#${escaped}(?=\\s|$)`, 'i').test(plainText)
      if (!alreadyInTitle) {
        // Append via editor if available
        const editor = titleEditorRef.current
        if (editor) {
          editor.commands.focus('end')
          const currentText = editor.getText()
          const prefix = currentText.length > 0 ? ' ' : ''
          editor.commands.insertContent(prefix + '#' + label.name)
        } else {
          setTitle((prev) => {
            const t = prev.trimEnd()
            return t ? t + ' #' + label.name : '#' + label.name
          })
        }
      }
    }
  }

  // â”€â”€ Remove label chip with title sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const removeLabel = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId)
    setSelectedLabelIds((prev) => prev.filter((id) => id !== labelId))
    if (label) setTitle((prev) => removeLabelToken(prev, label.name))
  }

  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSubmit = async () => {
    const plainTitle = stripHtmlTags(title)
    if (!plainTitle || !user) return
    let resolvedProjectId = projectId

    let cleanTitle = title

    // Auto-select any @projectname tokens that match existing projects
    for (const project of projects) {
      const escaped = project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`@${escaped}(?=\\s|$)`, 'i').test(plainTitle)) {
        resolvedProjectId = project.id
        cleanTitle = removeProjectToken(cleanTitle, project.name)
      }
    }

    const targetProjectId = resolvedProjectId || inboxProject?.id
    if (!targetProjectId) return

    // Auto-select any #labelname tokens that match existing labels (check plain text)
    const finalLabelIds = [...selectedLabelIds]
    for (const label of labels) {
      const escaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (
        new RegExp(`#${escaped}(?=\\s|$)`, 'i').test(stripHtmlTags(cleanTitle)) &&
        !finalLabelIds.includes(label.id)
      ) {
        finalLabelIds.push(label.id)
      }
    }

    // Strip all #labelname tokens from the HTML title
    for (const labelId of finalLabelIds) {
      const label = labels.find((l) => l.id === labelId)
      if (label) cleanTitle = removeLabelToken(cleanTitle, label.name)
    }

    // Auto-detect p1-p4 priority tokens and resolve
    let resolvedPriority = priority
    const plainForPrio = stripHtmlTags(cleanTitle)
    const prioMatches = [...plainForPrio.matchAll(/(?:^|\s)p([1-4])(?=\s|$)/gi)]
    if (prioMatches.length > 0) {
      resolvedPriority = parseInt(prioMatches[prioMatches.length - 1]![1]!) as 1 | 2 | 3 | 4
    }
    cleanTitle = removePriorityTokens(cleanTitle)

    // â”€â”€ NLP: detect date / time / duration / recurrence tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const nlp = parseNLPTokens(stripHtmlTags(cleanTitle))
    const resolvedDate = nlp.date ?? dueDate
    const resolvedTime = nlp.hasTime ? nlp.time : dueTime
    const resolvedHasTime = nlp.hasTime || hasTime
    const resolvedDuration = nlp.durationMinutes ?? durationMinutes
    const resolvedIsRecurring = nlp.isRecurring || isRecurring
    const resolvedRecurrenceRule = nlp.isRecurring ? nlp.recurrenceRule : recurrenceRule

    cleanTitle = stripNLPTokens(cleanTitle, nlp.patterns)

    if (!stripHtmlTags(cleanTitle)) return

    let dueDatetime: string | null = null
    if (resolvedDate && resolvedHasTime && resolvedTime) {
      dueDatetime = new Date(`${resolvedDate}T${resolvedTime}:00`).toISOString()
    }

    let savedTaskId: string | undefined

    if (task) {
      const updated = await updateTask.mutateAsync({
        id: task.id,
        updates: {
          title: cleanTitle,
          description: description || null,
          priority: resolvedPriority,
          due_date: resolvedDate || null,
          due_datetime: dueDatetime,
          has_time: resolvedHasTime,
          duration_minutes: resolvedDuration,
          is_recurring: resolvedIsRecurring,
          recurrence_rule: resolvedRecurrenceRule,
          recurrence_from: recurrenceFrom,
          deadline: deadline || null,
          project_id: targetProjectId,
          label_ids: finalLabelIds,
        },
      })
      savedTaskId = updated.id
    } else {
      const created = await createTask.mutateAsync({
        user_id: user.id,
        project_id: targetProjectId,
        title: cleanTitle,
        description: description || null,
        priority: resolvedPriority,
        due_date: resolvedDate || null,
        due_datetime: dueDatetime,
        has_time: resolvedHasTime,
        duration_minutes: resolvedDuration,
        is_recurring: resolvedIsRecurring,
        recurrence_rule: resolvedRecurrenceRule,
        recurrence_from: recurrenceFrom,
        deadline: deadline || null,
        label_ids: finalLabelIds,
        section_id: defaultSectionId ?? null,
      })
      savedTaskId = created.id
    }

    // Create pending reminders
    if (savedTaskId && pendingReminders.length > 0) {
      for (const config of pendingReminders) {
        const remindAt = resolveReminderConfig(config, resolvedDate, resolvedTime)
        if (remindAt) {
          await createReminder.mutateAsync({
            task_id: savedTaskId,
            remind_at: remindAt,
          })
        }
      }
    }

    onClose()
  }

  if (!open) return null

  const selectedProject = projects.find((p) => p.id === projectId) ?? inboxProject
  const selectedLabels = labels.filter((l) => selectedLabelIds.includes(l.id))
  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(labelSearch.toLowerCase()),
  )
  const filteredProjects = projects.filter(
    (p) => !p.is_archived && p.name.toLowerCase().includes(projectSearch.toLowerCase()),
  )

  // Hash autocomplete (#labels)
  const hashFilteredLabels =
    hashQuery !== null
      ? labels.filter((l) => l.name.toLowerCase().includes(hashQuery.toLowerCase()))
      : []
  const showHashCreate =
    hashQuery !== null &&
    hashQuery.trim() !== '' &&
    !labels.some((l) => l.name.toLowerCase() === hashQuery.trim().toLowerCase())
  const hashTotalItems = hashFilteredLabels.length + (showHashCreate ? 1 : 0)

  // At autocomplete (@projects)
  const atFilteredProjects =
    atQuery !== null
      ? projects.filter((p) => !p.is_archived && p.name.toLowerCase().includes(atQuery.toLowerCase()))
      : []
  const atTotalItems = atFilteredProjects.length

  const editorCard = (
    <>
      {/* Title with hash autocomplete */}
          <div className="relative">
            <TitleEditor
              content={title}
              onChange={setTitle}
              onSubmit={() => {
                if (hashQuery !== null && hashTotalItems > 0) {
                  if (hashHighlightIdx < hashFilteredLabels.length) {
                    confirmHashLabel(hashFilteredLabels[hashHighlightIdx]!)
                  } else if (showHashCreate && hashQuery?.trim()) {
                    createAndConfirmHash(hashQuery.trim())
                  }
                } else if (atQuery !== null && atTotalItems > 0) {
                  confirmAtProject(atFilteredProjects[atHighlightIdx]!)
                } else {
                  handleSubmit()
                }
              }}
              onEscape={() => {
                if (hashQuery !== null) {
                  setHashQuery(null)
                } else if (atQuery !== null) {
                  setAtQuery(null)
                } else {
                  onClose()
                }
              }}
              autoFocus
              editorRef={titleEditorRef}
              onUpdate={handleTitleUpdate}
              onKeyDown={(event) => {
                // Auto-confirm p1-p4 priority tokens on Space
                if (event.key === ' ') {
                  const ed = titleEditorRef.current
                  if (ed) {
                    const { anchor } = ed.state.selection
                    const textBeforeCursor = ed.state.doc.textBetween(0, anchor, '')
                    const pMatch = textBeforeCursor.match(/(^|\s)(p[1-4])$/i)
                    if (pMatch) {
                      event.preventDefault()
                      const pNum = parseInt(pMatch[2]![1]!) as 1 | 2 | 3 | 4
                      const tokenLen = 2
                      const tokenStartPlain = textBeforeCursor.length - tokenLen
                      const tokenEndPlain = textBeforeCursor.length

                      const doc = ed.state.doc
                      let textSeen = 0
                      let fromPos = 0
                      let toPos = 0
                      doc.descendants((node, nodePos) => {
                        if (node.isText) {
                          const ns = textSeen
                          const ne = textSeen + node.text!.length
                          if (fromPos === 0 && tokenStartPlain >= ns && tokenStartPlain < ne) {
                            fromPos = nodePos + (tokenStartPlain - ns)
                          }
                          if (toPos === 0 && tokenEndPlain >= ns && tokenEndPlain <= ne) {
                            toPos = nodePos + (tokenEndPlain - ns)
                          }
                          textSeen = ne
                        }
                        return fromPos === 0 || toPos === 0
                      })

                      if (fromPos && toPos) {
                        ed.chain().focus()
                          .deleteRange({ from: fromPos, to: toPos })
                          .insertContentAt(fromPos, [
                            { type: 'text', text: pMatch[2]!.toLowerCase(), marks: [{ type: 'textStyle', attrs: { color: PRIORITY_COLORS[pNum] } }] },
                            { type: 'text', text: ' ' },
                          ])
                          .run()
                      }

                      setPriority(pNum)
                      return true
                    }
                  }
                }
                if (hashQuery !== null && hashTotalItems > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setHashHighlightIdx((prev) => (prev + 1) % hashTotalItems)
                    return true
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setHashHighlightIdx((prev) => (prev - 1 + hashTotalItems) % hashTotalItems)
                    return true
                  }
                }
                if (atQuery !== null && atTotalItems > 0) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setAtHighlightIdx((prev) => (prev + 1) % atTotalItems)
                    return true
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setAtHighlightIdx((prev) => (prev - 1 + atTotalItems) % atTotalItems)
                    return true
                  }
                }
                return false
              }}
            />

            {/* Hash autocomplete dropdown */}
            {hashQuery !== null && hashTotalItems > 0 && (
              <div
                className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border py-1 shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {hashFilteredLabels.map((label, idx) => (
                  <button
                    key={label.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      confirmHashLabel(label)
                    }}
                    onMouseEnter={() => setHashHighlightIdx(idx)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: idx === hashHighlightIdx ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="flex-1 text-left">{label.name}</span>
                    {selectedLabelIds.includes(label.id) && (
                      <Check size={11} style={{ color: 'var(--text-primary)' }} />
                    )}
                  </button>
                ))}
                {showHashCreate && (
                  <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        createAndConfirmHash(hashQuery.trim())
                      }}
                      onMouseEnter={() => setHashHighlightIdx(hashFilteredLabels.length)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
                      style={{
                        backgroundColor:
                          hashHighlightIdx === hashFilteredLabels.length
                            ? 'var(--bg-hover)'
                            : 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      Crear «<span className="font-semibold">{hashQuery.trim()}</span>»
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* At autocomplete dropdown (@projects) */}
            {atQuery !== null && atTotalItems > 0 && (
              <div
                className="absolute left-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border py-1 shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {atFilteredProjects.map((project, idx) => (
                  <button
                    key={project.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      confirmAtProject(project)
                    }}
                    onMouseEnter={() => setAtHighlightIdx(idx)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-sm"
                    style={{
                      backgroundColor: idx === atHighlightIdx ? 'var(--bg-hover)' : 'transparent',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="flex-1 text-left">{project.name}</span>
                    {projectId === project.id && (
                      <Check size={11} style={{ color: 'var(--text-primary)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Description with Markdown */}
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Descripción
            </p>
            <MarkdownEditor
              content={description}
              onChange={setDescription}
              placeholder="Agregar descripción..."
              minHeight={72}
            />
          </div>

          {/* Selected labels */}
          {selectedLabels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedLabels.map((label) => (
                <span
                  key={label.id}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: label.color + '22', color: label.color }}
                >
                  {label.name}
                  <button onClick={() => removeLabel(label.id)}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Action bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Date/time picker */}
            <DateTimePicker
              date={dueDate}
              time={dueTime}
              hasTime={hasTime}
              durationMinutes={durationMinutes}
              isRecurring={isRecurring}
              recurrenceRule={recurrenceRule}
              recurrenceFrom={recurrenceFrom}
              onDateChange={setDueDate}
              onTimeChange={setDueTime}
              onHasTimeChange={setHasTime}
              onDurationChange={setDurationMinutes}
              onRecurrenceChange={(recurring, rule, from) => {
                setIsRecurring(recurring)
                setRecurrenceRule(rule)
                setRecurrenceFrom(from)
              }}
            />

            {/* Deadline */}
            <DeadlinePicker
              deadline={deadline}
              onDeadlineChange={setDeadline}
            />

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: priority < 4 ? PRIORITY_COLORS[priority] + '15' : 'var(--bg-secondary)',
                  borderColor: priority < 4 ? PRIORITY_COLORS[priority] + '40' : 'var(--border-primary)',
                  color: priority < 4 ? PRIORITY_COLORS[priority] : 'var(--text-primary)',
                }}
              >
                <Flag size={14} />
                Prioridad
                <ChevronDown size={12} />
              </button>
              {showPriorityMenu && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border py-1 shadow-lg"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  {([1, 2, 3, 4] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => { setPriority(p); setShowPriorityMenu(false) }}
                      className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors')}
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                      {PRIORITY_LABELS[p]}
                      {priority === p && <Check size={12} className="ml-auto" style={{ color: '#283B56' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Project */}
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: selectedProject?.color ?? '#283B56' }} />
                {selectedProject?.name ?? 'Entrada'}
                <ChevronDown size={12} />
              </button>
              {showProjectMenu && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border shadow-lg"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <div className="p-2">
                    <input
                      autoFocus
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const trimmed = projectSearch.trim()
                          if (!trimmed) return
                          const exact = projects.find(
                            (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
                          )
                          if (exact) {
                            setProjectId(exact.id)
                            setProjectSearch('')
                            setShowProjectMenu(false)
                          } else if (user) {
                            const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
                            createProject.mutateAsync({ user_id: user.id, name: trimmed, color }).then((p) => {
                              setProjectId(p.id)
                              setProjectSearch('')
                              setShowProjectMenu(false)
                            })
                          }
                        }
                        if (e.key === 'Escape') setShowProjectMenu(false)
                      }}
                      placeholder="Buscar o crear proyecto..."
                      className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto py-1">
                    {filteredProjects.map((p) => {
                      const active = projectId === p.id
                      const hovered = hoveredProjectId === p.id
                      const editing = editingProjectId === p.id

                      if (editing) {
                        return (
                          <div key={p.id} className="flex items-center gap-1.5 px-2 py-1.5">
                            <ColorPicker
                              size="sm"
                              value={editingProjectColor}
                              onChange={setEditingProjectColor}
                            />
                            <input
                              autoFocus
                              value={editingProjectName}
                              onChange={(e) => setEditingProjectName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const name = editingProjectName.trim()
                                  if (name) updateProject.mutate({ id: p.id, updates: { name, color: editingProjectColor } })
                                  setEditingProjectId(null)
                                }
                                if (e.key === 'Escape') setEditingProjectId(null)
                              }}
                              onBlur={(e) => {
                                if (e.relatedTarget) return
                                const name = editingProjectName.trim()
                                if (name) updateProject.mutate({ id: p.id, updates: { name, color: editingProjectColor } })
                                setEditingProjectId(null)
                              }}
                              className="flex-1 rounded border px-2 py-0.5 text-xs outline-none"
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </div>
                        )
                      }

                      return (
                        <div
                          key={p.id}
                          className="flex items-center px-2"
                          onMouseEnter={() => setHoveredProjectId(p.id)}
                          onMouseLeave={() => setHoveredProjectId(null)}
                          style={{ backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent' }}
                        >
                          <button
                            onClick={() => { setProjectId(p.id); setShowProjectMenu(false) }}
                            className="flex flex-1 items-center gap-2 py-1.5 text-sm"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="flex-1 text-left truncate">{p.name}</span>
                            {active && !hovered && <Check size={12} style={{ color: 'var(--text-primary)' }} />}
                          </button>
                          {hovered && !p.is_inbox && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingProjectId(p.id)
                                  setEditingProjectName(p.name)
                                  setEditingProjectColor(p.color)
                                }}
                                className="rounded p-1 transition-all"
                                style={{ color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'var(--bg-active)'
                                  e.currentTarget.style.color = 'var(--text-primary)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                  e.currentTarget.style.color = 'var(--text-muted)'
                                }}
                                title="Editar proyecto"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  showConfirmDialog({
                                    title: 'Eliminar proyecto',
                                    message: `¿Eliminar el proyecto «${p.name}»? Las tareas dentro serán movidas a Entrada.`,
                                    confirmLabel: 'Eliminar',
                                    onConfirm: () => {
                                      deleteProject.mutate(p.id)
                                      if (projectId === p.id) setProjectId(inboxProject?.id ?? '')
                                      setHoveredProjectId(null)
                                    },
                                  })
                                }}
                                className="rounded p-1 transition-all"
                                style={{ color: '#EC1E2A', backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(236,30,42,0.1)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                title="Eliminar proyecto"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}

                    {/* Create project option */}
                    {projectSearch.trim() &&
                      !projects.some(
                        (p) => p.name.toLowerCase() === projectSearch.trim().toLowerCase(),
                      ) && (
                        <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                          <button
                            onClick={() => {
                              if (!user) return
                              const trimmed = projectSearch.trim()
                              const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
                              createProject.mutateAsync({ user_id: user.id, name: trimmed, color }).then((p) => {
                                setProjectId(p.id)
                                setProjectSearch('')
                              })
                            }}
                            disabled={createProject.isPending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                          >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>Crear «<span className="font-semibold">{projectSearch.trim()}</span>»</span>
                          </button>
                        </div>
                      )}

                    {filteredProjects.length === 0 && !projectSearch.trim() && (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Sin proyectos aún
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Reminders */}
            <ReminderPicker
              reminders={pendingReminders}
              onAdd={(r) => setPendingReminders((prev) => [...prev, r])}
              onRemove={(i) => setPendingReminders((prev) => prev.filter((_, idx) => idx !== i))}
              hasDateTime={hasTime && !!dueDate && !!dueTime}
              dueDate={dueDate}
              dueTime={dueTime}
            />

            {/* Labels */}
            <div className="relative">
              <button
                onClick={() => setShowLabelMenu(!showLabelMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: selectedLabelIds.length > 0 ? 'rgba(107,114,128,0.1)' : 'var(--bg-secondary)',
                  borderColor: selectedLabelIds.length > 0 ? 'rgba(107,114,128,0.3)' : 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <Tag size={14} />
                Etiquetas
                {selectedLabelIds.length > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: '#283B56' }}
                  >
                    {selectedLabelIds.length}
                  </span>
                )}
              </button>
              {showLabelMenu && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border shadow-lg"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  <div className="p-2">
                    <input
                      autoFocus
                      value={labelSearch}
                      onChange={(e) => setLabelSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const trimmed = labelSearch.trim()
                          if (!trimmed) return
                          const exact = labels.find(
                            (l) => l.name.toLowerCase() === trimmed.toLowerCase(),
                          )
                          if (exact) {
                            toggleLabel(exact.id)
                            setLabelSearch('')
                          } else {
                            const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]
                            createLabel.mutateAsync({ name: trimmed, color }).then((newLabel) => {
                              setSelectedLabelIds((prev) => [...prev, newLabel.id])
                              setLabelSearch('')
                            })
                          }
                        }
                        if (e.key === 'Escape') setShowLabelMenu(false)
                      }}
                      placeholder="Buscar o crear etiqueta..."
                      className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto py-1">
                    {filteredLabels.map((label) => {
                      const active = selectedLabelIds.includes(label.id)
                      const hovered = hoveredLabelId === label.id
                      const editing = editingLabelId === label.id

                      if (editing) {
                        return (
                          <div key={label.id} className="flex items-center gap-1.5 px-2 py-1.5">
                            <ColorPicker
                              size="sm"
                              value={editingLabelColor}
                              onChange={setEditingLabelColor}
                            />
                            <input
                              autoFocus
                              value={editingLabelName}
                              onChange={(e) => setEditingLabelName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  const name = editingLabelName.trim()
                                  if (name) updateLabel.mutate({ id: label.id, updates: { name, color: editingLabelColor } })
                                  setEditingLabelId(null)
                                }
                                if (e.key === 'Escape') setEditingLabelId(null)
                              }}
                              onBlur={(e) => {
                                if (e.relatedTarget) return
                                const name = editingLabelName.trim()
                                if (name) updateLabel.mutate({ id: label.id, updates: { name, color: editingLabelColor } })
                                setEditingLabelId(null)
                              }}
                              className="flex-1 rounded border px-2 py-0.5 text-xs outline-none"
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </div>
                        )
                      }

                      return (
                        <div
                          key={label.id}
                          className="flex items-center px-2"
                          onMouseEnter={() => setHoveredLabelId(label.id)}
                          onMouseLeave={() => setHoveredLabelId(null)}
                          style={{ backgroundColor: hovered ? 'var(--bg-hover)' : 'transparent' }}
                        >
                          <button
                            onClick={() => toggleLabel(label.id)}
                            className="flex flex-1 items-center gap-2 py-1.5 text-sm"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                            <span className="flex-1 text-left">{label.name}</span>
                            {active && !hovered && <Check size={12} style={{ color: '#283B56' }} />}
                          </button>
                          {hovered && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingLabelId(label.id)
                                  setEditingLabelName(label.name)
                                  setEditingLabelColor(label.color)
                                }}
                                className="rounded p-1 transition-all"
                                style={{ color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(40,59,86,0.12)'
                                  e.currentTarget.style.color = '#283B56'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                  e.currentTarget.style.color = 'var(--text-muted)'
                                }}
                                title="Editar etiqueta"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  showConfirmDialog({
                                    title: 'Eliminar etiqueta',
                                    message: `¿Eliminar la etiqueta «${label.name}»? Se quitará de todas las tareas que la usen.`,
                                    confirmLabel: 'Eliminar',
                                    onConfirm: () => {
                                      deleteLabel.mutate(label.id)
                                      setSelectedLabelIds((prev) => prev.filter((id) => id !== label.id))
                                      setHoveredLabelId(null)
                                    },
                                  })
                                }}
                                className="rounded p-1 transition-all"
                                style={{ color: '#EC1E2A', backgroundColor: 'transparent' }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(236,30,42,0.1)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                title="Eliminar etiqueta"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      )
                    })}

                    {/* Opción crear si no hay coincidencia exacta */}
                    {labelSearch.trim() &&
                      !labels.some(
                        (l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase(),
                      ) && (
                        <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
                          <button
                            onClick={() => {
                              const trimmed = labelSearch.trim()
                              const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]
                              createLabel.mutateAsync({ name: trimmed, color }).then((newLabel) => {
                                setSelectedLabelIds((prev) => [...prev, newLabel.id])
                                setLabelSearch('')
                              })
                            }}
                            disabled={createLabel.isPending}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
                            style={{
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                          >
                            <Plus size={14} strokeWidth={2.5} />
                            <span>Crear «<span className="font-semibold">{labelSearch.trim()}</span>»</span>
                          </button>
                        </div>
                      )}

                    {filteredLabels.length === 0 && !labelSearch.trim() && (
                      <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Sin etiquetas aún
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!stripHtmlTags(title) || createTask.isPending || updateTask.isPending}
            className="flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#283B56' }}
          >
            <span>{task ? 'Guardar' : 'Añadir tarea'}</span>
            {!task && !inline && <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[10px]">Q</span>}
          </button>
        </div>
    </>
  )

  if (inline) {
    return (
      <div
        className="mt-2 w-full rounded-xl border"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="p-4">
          {editorCard}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-3xl rounded-xl border shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="p-4">
          {editorCard}
        </div>
      </div>
    </div>
  )
}
