import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  X,
  Flag,
  ChevronDown,
  Folder,
  Plus,
  Check,
  Tag,
  Trash2,
  Bell,
  ArrowLeft,
  Maximize2,
  Repeat,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useUIStore } from '@/stores/uiStore'
import {
  useTask,
  useSubtasks,
  useUpdateTask,
  useCreateTask,
  useCompleteTask,
  useDeleteTask,
} from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import {
  useTaskLabels,
  useLabels,
  useSetTaskLabels,
  useCreateLabel,
  LABEL_COLORS,
} from '@/hooks/useLabels'
import { useAllSections } from '@/hooks/useSections'
import type { Editor } from '@tiptap/react'
import { useTaskReminders, useCreateReminder, useDeleteReminder } from '@/hooks/useReminders'
import { useAuth } from '@/hooks/useAuth'
import { TaskCheckbox } from './TaskCheckbox'
import { TitleEditor } from './TitleEditor'
import { MarkdownEditor } from './MarkdownEditor'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { DeadlinePicker } from '@/components/common/DeadlinePicker'
import { ReminderPicker, resolveReminderConfig } from '@/components/common/ReminderPicker'
import type { ReminderConfig } from '@/components/common/ReminderPicker'
import { cn, stripHtmlTags, formatRelativeDate, stripLabelTokensFromHtml } from '@/lib/utils'
import { buildProjectTree, flattenProjectTree } from '@/lib/projectTree'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { format } from 'date-fns'
import type { Task } from '@/lib/types'
import { parseNLPTokens, stripNLPTokens } from '@/services/dateParser'

interface TaskDetailProps {
  fullScreen?: boolean
  taskId?: string
}

export function TaskDetail({ fullScreen = false, taskId: propTaskId }: TaskDetailProps = {}) {
  const navigate = useNavigate()
  const { selectedTaskId, setSelectedTaskId } = useAppStore()
  const effectiveTaskId = propTaskId ?? selectedTaskId
  const { showConfirmDialog } = useUIStore()
  const { data: task, isLoading } = useTask(effectiveTaskId)
  const { data: subtasks = [] } = useSubtasks(effectiveTaskId)
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()
  const { data: taskLabels = [] } = useTaskLabels(effectiveTaskId ?? '')
  const { data: serverReminders = [] } = useTaskReminders(effectiveTaskId ?? '')
  const { user } = useAuth()
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const setTaskLabels = useSetTaskLabels()
  const createLabel = useCreateLabel()
  const createReminder = useCreateReminder()
  const deleteReminder = useDeleteReminder()
  const { data: sectionsMap } = useAllSections()

  // Navigation stack for subtasks
  const [parentStack, setParentStack] = useState<string[]>([])

  // Local state synced from task
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [dueTime, setDueTime] = useState<string | null>(null)
  const [hasTime, setHasTime] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceRule, setRecurrenceRule] = useState<string | null>(null)
  const [recurrenceFrom, setRecurrenceFrom] = useState<'due_date' | 'completion_date'>('due_date')
  const [deadline, setDeadline] = useState<string | null>(null)
  const [newSubtask, setNewSubtask] = useState('')
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  // Track which fields were set by live NLP so we can revert them when the token is removed
  const nlpAppliedRef = useRef({ date: false, time: false, duration: false, recurrence: false })

  // Hash autocomplete state (#labels)
  const [hashQuery, setHashQuery] = useState<string | null>(null)
  const [hashStart, setHashStart] = useState(0)
  const [hashHighlightIdx, setHashHighlightIdx] = useState(0)
  // At autocomplete state (@projects + sections)
  const [atQuery, setAtQuery] = useState<string | null>(null)
  const [atStart, setAtStart] = useState(0)
  const [atHighlightIdx, setAtHighlightIdx] = useState(0)
  const titleEditorRef = useRef<Editor | null>(null)

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

  // Sync from server
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueDate(task.due_date ?? null)
    setHasTime(task.has_time)
    setDurationMinutes(task.duration_minutes)
    setIsRecurring(task.is_recurring)
    setRecurrenceRule(task.recurrence_rule ?? null)
    setRecurrenceFrom(task.recurrence_from ?? 'due_date')
    setDeadline(task.deadline ?? null)
    if (task.has_time && task.due_datetime) {
      const d = new Date(task.due_datetime)
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      setDueTime(`${hh}:${mm}`)
    } else {
      setDueTime(null)
    }
    nlpAppliedRef.current = { date: false, time: false, duration: false, recurrence: false }
    setHashQuery(null)
    setAtQuery(null)
  }, [task?.id, task?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live NLP: update pickers as user types date/time/duration/recurrence tokens in title
  useEffect(() => {
    if (!task) return
    const plainText = stripHtmlTags(title)
    const nlp = parseNLPTokens(plainText)
    const applied = nlpAppliedRef.current

    if (nlp.date !== null) {
      setDueDate(nlp.date)
      applied.date = true
    } else if (applied.date) {
      setDueDate(task.due_date ?? null)
      applied.date = false
    }

    if (nlp.hasTime && nlp.time) {
      setDueTime(nlp.time)
      setHasTime(true)
      applied.time = true
    } else if (applied.time) {
      setDueTime(null)
      setHasTime(task.has_time)
      applied.time = false
    }

    if (nlp.durationMinutes !== null) {
      setDurationMinutes(nlp.durationMinutes)
      applied.duration = true
    } else if (applied.duration) {
      setDurationMinutes(task.duration_minutes)
      applied.duration = false
    }

    if (nlp.isRecurring && nlp.recurrenceRule) {
      setIsRecurring(true)
      setRecurrenceRule(nlp.recurrenceRule)
      applied.recurrence = true
    } else if (applied.recurrence) {
      setIsRecurring(task.is_recurring)
      setRecurrenceRule(task.recurrence_rule ?? null)
      applied.recurrence = false
    }
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!effectiveTaskId) return null

  const close = () => {
    if (fullScreen) {
      if (window.history.length > 1) {
        navigate(-1)
      } else {
        navigate('/app/today')
      }
    } else {
      setSelectedTaskId(null)
      setParentStack([])
    }
  }

  const goBack = () => {
    const prev = parentStack[parentStack.length - 1]
    if (prev) {
      setParentStack((s) => s.slice(0, -1))
      setSelectedTaskId(prev)
    }
  }

  const openSubtask = (subtaskId: string) => {
    if (fullScreen) {
      navigate(`/app/task/${subtaskId}`)
    } else {
      setParentStack((s) => [...s, effectiveTaskId!])
      setSelectedTaskId(subtaskId)
    }
  }

  /* ── Save helpers ──────────────────────────────── */
  const save = async (updates: Partial<Task>) => {
    if (!task) return
    setSaving(true)
    await updateTask.mutateAsync({ id: task.id, updates })
    setSaving(false)
  }

  /* ── Autocomplete helpers ─────────────────────── */
  type AtItem =
    | {
        kind: 'project'
        id: string
        name: string
        color: string
        icon?: string | null
        depth: number
      }
    | {
        kind: 'section'
        id: string
        name: string
        projectId: string
        projectColor: string
        depth: number
      }

  const confirmHashLabel = (label: { id: string; name: string; color: string }) => {
    const editor = titleEditorRef.current
    if (!editor) return
    const hashEnd = hashStart + 1 + (hashQuery?.length ?? 0)
    const doc = editor.state.doc
    let textSeen = 0
    let fromPos = 0
    let toPos = 0
    doc.descendants((node, nodePos) => {
      if (node.isText) {
        const ns = textSeen
        const ne = textSeen + node.text!.length
        if (fromPos === 0 && hashStart >= ns && hashStart < ne) fromPos = nodePos + (hashStart - ns)
        if (toPos === 0 && hashEnd >= ns && hashEnd <= ne) toPos = nodePos + (hashEnd - ns)
        textSeen = ne
      }
      return fromPos === 0 || toPos === 0
    })
    if (fromPos && toPos) {
      editor.chain().focus().deleteRange({ from: fromPos, to: toPos }).run()
    }
    if (!task) return
    const currentIds = taskLabels.map((l) => l.id)
    const next = currentIds.includes(label.id) ? currentIds : [...currentIds, label.id]
    setTaskLabels.mutate({ taskId: task.id, labelIds: next })
    setHashQuery(null)
  }

  const createAndConfirmHash = async (name: string) => {
    const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]!
    const newLabel = await createLabel.mutateAsync({ name, color })
    confirmHashLabel(newLabel)
  }

  const confirmAtItem = (item: AtItem) => {
    const editor = titleEditorRef.current
    if (!editor) return
    const atEnd = atStart + 1 + (atQuery?.length ?? 0)
    const doc = editor.state.doc
    let textSeen = 0
    let fromPos = 0
    let toPos = 0
    doc.descendants((node, nodePos) => {
      if (node.isText) {
        const ns = textSeen
        const ne = textSeen + node.text!.length
        if (fromPos === 0 && atStart >= ns && atStart < ne) fromPos = nodePos + (atStart - ns)
        if (toPos === 0 && atEnd >= ns && atEnd <= ne) toPos = nodePos + (atEnd - ns)
        textSeen = ne
      }
      return fromPos === 0 || toPos === 0
    })
    if (fromPos && toPos) {
      editor.chain().focus().deleteRange({ from: fromPos, to: toPos }).run()
    }
    if (item.kind === 'project') {
      save({ project_id: item.id, section_id: null })
    } else {
      save({ project_id: item.projectId, section_id: item.id })
    }
    setAtQuery(null)
  }

  const handleTitleBlur = () => {
    if (!task) return
    const plainText = stripHtmlTags(title)
    if (!plainText.trim()) return

    let cleanTitle = title
    const updates: Partial<Task> = {}

    // Parse NLP tokens (date, time, duration, recurrence)
    const nlp = parseNLPTokens(plainText)
    if (nlp.date !== null) {
      updates.due_date = nlp.date
      if (nlp.hasTime && nlp.time) {
        updates.has_time = true
        updates.due_datetime = new Date(`${nlp.date}T${nlp.time}:00`).toISOString()
      }
    }
    if (nlp.durationMinutes !== null) {
      updates.duration_minutes = nlp.durationMinutes
    }
    if (nlp.isRecurring && nlp.recurrenceRule) {
      updates.is_recurring = true
      updates.recurrence_rule = nlp.recurrenceRule
    }

    // Strip NLP tokens from HTML
    cleanTitle = stripNLPTokens(cleanTitle, nlp.patterns)

    // Handle @projectname tokens (strip and save project change)
    for (const project of projects) {
      const escaped = project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`@${escaped}(?=\\s|$)`, 'i').test(stripHtmlTags(cleanTitle))) {
        updates.project_id = project.id
        updates.section_id = null
        const div = document.createElement('div')
        div.innerHTML = cleanTitle
        const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          node.textContent = (node.textContent ?? '')
            .replace(new RegExp(`@${escaped}(?=\\s|$)`, 'gi'), '')
            .replace(/\s+/g, ' ')
        }
        cleanTitle = div.innerHTML
      }
    }

    // Handle #labelname tokens (strip and add labels to task)
    const currentLabelIds = taskLabels.map((l) => l.id)
    const newLabelIds = [...currentLabelIds]
    let addedLabel = false
    for (const label of labels) {
      const escaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`#${escaped}(?=\\s|$)`, 'i').test(stripHtmlTags(cleanTitle))) {
        if (!newLabelIds.includes(label.id)) {
          newLabelIds.push(label.id)
          addedLabel = true
        }
        const div = document.createElement('div')
        div.innerHTML = cleanTitle
        const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
        let node: Text | null
        while ((node = walker.nextNode() as Text | null)) {
          node.textContent = (node.textContent ?? '')
            .replace(new RegExp(`#${escaped}(?=\\s|$)`, 'gi'), '')
            .replace(/\s+/g, ' ')
        }
        cleanTitle = div.innerHTML
      }
    }
    if (addedLabel) {
      setTaskLabels.mutate({ taskId: task.id, labelIds: newLabelIds })
    }

    // Detect and strip priority tokens (p1-p4)
    const plainAfterNLP = stripHtmlTags(cleanTitle)
    const prioMatches = [...plainAfterNLP.matchAll(/(?:^|\s)p([1-4])(?=\s|$)/gi)]
    if (prioMatches.length > 0) {
      updates.priority = parseInt(prioMatches[prioMatches.length - 1]![1]!) as 1 | 2 | 3 | 4
    }
    cleanTitle = stripPriorityTokens(cleanTitle)

    const cleanPlain = stripHtmlTags(cleanTitle).trim()
    if (!cleanPlain) return

    // Update local title state (stripped of tokens)
    setTitle(cleanTitle)

    // Save metadata changes immediately (date, priority, project) but NOT the title text
    // Title text is saved explicitly via the Save button
    if (Object.keys(updates).length > 0) {
      save(updates)
    }
  }

  const handleDescriptionChange = (html: string) => {
    setDescription(html)
  }

  // Description changes are saved via the Save button, not on blur
  const handleDescriptionBlur = () => {}

  /* ── Explicit save (title + description) ──── */
  const isDirty = !!task && (title !== task.title || description !== (task.description ?? ''))

  // Keep a stable ref so the Ctrl+S keyboard handler always uses the latest version
  const saveMainRef = useRef<() => void>(() => {})
  const handleSaveMain = async () => {
    if (!task) return
    const plainTitle = stripHtmlTags(title).trim()
    if (!plainTitle) return
    await save({ title, description: description || null })
  }
  saveMainRef.current = handleSaveMain

  /* ── Date/Time handlers (save immediately) ──── */
  const handleDateChange = (date: string | null) => {
    setDueDate(date)
    save({ due_date: date })
  }

  const handleTimeChange = (time: string | null) => {
    setDueTime(time)
    if (time && dueDate) {
      const dt = new Date(`${dueDate}T${time}:00`)
      save({ due_datetime: dt.toISOString() })
    } else {
      save({ due_datetime: null })
    }
  }

  const handleHasTimeChange = (ht: boolean) => {
    setHasTime(ht)
    if (!ht) {
      setDueTime(null)
      save({ has_time: false, due_datetime: null })
    } else {
      save({ has_time: true })
    }
  }

  const handleDurationChange = (min: number | null) => {
    setDurationMinutes(min)
    save({ duration_minutes: min })
  }

  const handleRecurrenceChange = (
    recurring: boolean,
    rule: string | null,
    from: 'due_date' | 'completion_date',
  ) => {
    setIsRecurring(recurring)
    setRecurrenceRule(rule)
    setRecurrenceFrom(from)
    save({ is_recurring: recurring, recurrence_rule: rule, recurrence_from: from })
  }

  const handleDeadlineChange = (dl: string | null) => {
    setDeadline(dl)
    save({ deadline: dl })
  }

  const handlePriorityChange = (p: 1 | 2 | 3 | 4) => {
    save({ priority: p })
    setShowPriorityMenu(false)
  }

  const handleProjectChange = (projectId: string) => {
    save({ project_id: projectId })
    setShowProjectMenu(false)
  }

  const handleToggleLabel = (labelId: string) => {
    if (!task) return
    const currentIds = taskLabels.map((l) => l.id)
    const next = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId]
    setTaskLabels.mutate({ taskId: task.id, labelIds: next })
  }

  /* ── Reminders ────────────────────────────────── */
  const handleAddReminder = async (config: ReminderConfig) => {
    if (!task || !user) return
    const remindAt = resolveReminderConfig(config, dueDate, dueTime)
    if (!remindAt) return
    await createReminder.mutateAsync({
      task_id: task.id,
      remind_at: remindAt,
    })
  }

  const handleDeleteReminder = async (reminderId: string) => {
    await deleteReminder.mutateAsync({ id: reminderId, task_id: task?.id ?? '' })
  }

  // Pending reminders for the ReminderPicker UI (existing server reminders displayed separately)
  const [pendingReminders, setPendingReminders] = useState<ReminderConfig[]>([])

  /* ── Subtasks ─────────────────────────────────── */
  const handleAddSubtask = async () => {
    if (!newSubtask.trim() || !task || !user) return
    await createTask.mutateAsync({
      user_id: user.id,
      project_id: task.project_id,
      title: newSubtask.trim(),
      parent_id: task.id,
    })
    setNewSubtask('')
  }

  const selectedProject = projects.find((p) => p.id === task?.project_id)

  const { detailPanelWidth, setDetailPanelWidth } = useAppStore()
  const isDragging = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const deadlinePickerRef = useRef<HTMLDivElement>(null)
  const reminderPickerRef = useRef<HTMLDivElement>(null)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcuts for TaskDetail sections
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S → explicit save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveMainRef.current()
        return
      }

      const tag = (e.target as HTMLElement).tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable
      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      switch (key) {
        case 'd':
          e.preventDefault()
          datePickerRef.current?.querySelector('button')?.click()
          break
        case 'l':
          e.preventDefault()
          deadlinePickerRef.current?.querySelector('button')?.click()
          break
        case 'f':
          e.preventDefault()
          setShowPriorityMenu((v) => !v)
          break
        case 'r':
          e.preventDefault()
          reminderPickerRef.current?.querySelector('button')?.click()
          break
        case 'o':
          e.preventDefault()
          setShowProjectMenu((v) => !v)
          break
        case 'e':
          e.preventDefault()
          setShowLabelMenu((v) => !v)
          break
        case 'n':
          e.preventDefault()
          subtaskInputRef.current?.focus()
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Resize handle drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      e.preventDefault()
      const newWidth = window.innerWidth - e.clientX
      setDetailPanelWidth(newWidth)
    }
    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [setDetailPanelWidth])

  const startResize = () => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

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

  // At autocomplete (@projects + sections)
  const allAtItems: AtItem[] = (() => {
    const flat = flattenProjectTree(buildProjectTree(projects.filter((p) => !p.is_archived)))
    const result: AtItem[] = []
    for (const proj of flat) {
      result.push({
        kind: 'project',
        id: proj.id,
        name: proj.name,
        color: proj.color,
        icon: proj.icon,
        depth: proj.depth,
      })
      const sections = (sectionsMap?.get(proj.id) ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
      for (const sec of sections) {
        result.push({
          kind: 'section',
          id: sec.id,
          name: sec.name,
          projectId: proj.id,
          projectColor: proj.color,
          depth: proj.depth + 1,
        })
      }
    }
    return result
  })()
  const atFilteredItems: AtItem[] =
    atQuery !== null
      ? allAtItems.filter((item) => item.name.toLowerCase().includes(atQuery.toLowerCase()))
      : []
  const atTotalItems = atFilteredItems.length

  /* ── Shared content (used in both panel and fullscreen) ── */
  const content =
    isLoading || !task ? (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    ) : (
      <>
        {/* Title + checkbox */}
        <div className={cn('p-4 pb-0', fullScreen && 'px-0')} onBlur={handleTitleBlur}>
          <div className="relative">
            <TitleEditor
              content={title}
              onChange={setTitle}
              className={cn(task.is_completed && 'line-through opacity-50')}
              textClassName={cn('font-medium leading-snug', fullScreen ? 'text-lg' : 'text-base')}
              editorRef={titleEditorRef}
              onUpdate={handleTitleUpdate}
              onKeyDown={(event) => {
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
                  if (event.key === 'Enter') {
                    if (hashHighlightIdx < hashFilteredLabels.length) {
                      confirmHashLabel(hashFilteredLabels[hashHighlightIdx]!)
                    } else if (showHashCreate && hashQuery?.trim()) {
                      createAndConfirmHash(hashQuery.trim())
                    }
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
                  if (event.key === 'Enter') {
                    confirmAtItem(atFilteredItems[atHighlightIdx]!)
                    return true
                  }
                }
                return false
              }}
              leftSlot={
                <div className="pt-0.5">
                  <TaskCheckbox
                    checked={task.is_completed}
                    priority={task.priority}
                    onChange={(checked) =>
                      completeTask.mutate({ id: task.id, completed: checked, task })
                    }
                  />
                </div>
              }
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
                    {taskLabels.some((l) => l.id === label.id) && (
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

            {/* At autocomplete dropdown (@projects + sections) */}
            {atQuery !== null && atTotalItems > 0 && (
              <div
                className="absolute left-0 top-full z-30 mt-1 max-h-56 w-64 overflow-y-auto overflow-x-hidden rounded-lg border py-1 shadow-lg"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  boxShadow: 'var(--shadow-lg)',
                }}
              >
                {atFilteredItems.map((item, idx) => (
                  <button
                    key={item.kind + '-' + item.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      confirmAtItem(item)
                    }}
                    onMouseEnter={() => setAtHighlightIdx(idx)}
                    className="flex w-full items-center gap-1.5 py-1.5 pr-3 text-sm"
                    style={{
                      paddingLeft: `${8 + item.depth * 14}px`,
                      backgroundColor: idx === atHighlightIdx ? 'var(--bg-hover)' : 'transparent',
                      color:
                        item.kind === 'section' ? 'var(--text-secondary)' : 'var(--text-primary)',
                    }}
                  >
                    {item.kind === 'project' ? (
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      />
                    ) : (
                      <span
                        className="flex-shrink-0 text-xs leading-none"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        —
                      </span>
                    )}
                    <span className="flex-1 truncate text-left">{item.name}</span>
                    {item.kind === 'project' && task.project_id === item.id && !task.section_id && (
                      <Check size={11} style={{ color: 'var(--text-primary)' }} />
                    )}
                    {item.kind === 'section' && task.section_id === item.id && (
                      <Check size={11} style={{ color: 'var(--text-primary)' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Description — MarkdownEditor */}
        <div
          className={cn('pb-2 pt-2', fullScreen ? 'px-0' : 'px-4')}
          onBlur={handleDescriptionBlur}
        >
          <MarkdownEditor
            content={description}
            onChange={handleDescriptionChange}
            placeholder="Agregar descripción..."
            minHeight={fullScreen ? 120 : 60}
          />
        </div>

        {/* Divider */}
        <div
          className={cn('border-t', fullScreen ? 'mx-0' : 'mx-4')}
          style={{ borderColor: 'var(--border-primary)' }}
        />

        {/* Properties */}
        <div className={cn('space-y-1 p-4', fullScreen && 'px-0')}>
          {/* Row 1: Date + Deadline side by side */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1">
            <div ref={datePickerRef}>
              <DateTimePicker
                date={dueDate}
                time={dueTime}
                hasTime={hasTime}
                durationMinutes={durationMinutes}
                isRecurring={isRecurring}
                recurrenceRule={recurrenceRule}
                recurrenceFrom={recurrenceFrom}
                onDateChange={handleDateChange}
                onTimeChange={handleTimeChange}
                onHasTimeChange={handleHasTimeChange}
                onDurationChange={handleDurationChange}
                onRecurrenceChange={handleRecurrenceChange}
                shortcutKey="D"
              />
            </div>
            <div ref={deadlinePickerRef}>
              <DeadlinePicker
                deadline={deadline}
                onDeadlineChange={handleDeadlineChange}
                shortcutKey="L"
              />
            </div>
          </div>

          {/* Row 2: Priority + Reminders side by side */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1">
            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor:
                    task.priority < 4
                      ? PRIORITY_COLORS[task.priority] + '18'
                      : 'var(--bg-secondary)',
                  borderColor:
                    task.priority < 4
                      ? PRIORITY_COLORS[task.priority] + '40'
                      : 'var(--border-primary)',
                  color: task.priority < 4 ? PRIORITY_COLORS[task.priority] : 'var(--text-primary)',
                }}
              >
                <Flag size={14} />
                {PRIORITY_LABELS[task.priority]}
                <span
                  className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
                  style={{
                    backgroundColor:
                      task.priority < 4
                        ? PRIORITY_COLORS[task.priority] + '22'
                        : 'var(--bg-primary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  F
                </span>
              </button>
              {showPriorityMenu && (
                <DropdownMenu onClose={() => setShowPriorityMenu(false)} width={160}>
                  {([1, 2, 3, 4] as const).map((p) => (
                    <DropdownItem
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      active={task.priority === p}
                    >
                      <Flag size={14} style={{ color: PRIORITY_COLORS[p] }} />
                      {PRIORITY_LABELS[p]}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </div>

            {/* Reminders — just the picker button, no title */}
            <div ref={reminderPickerRef}>
              <ReminderPicker
                reminders={pendingReminders}
                onAdd={async (r) => {
                  await handleAddReminder(r)
                }}
                onRemove={(i) => setPendingReminders((prev) => prev.filter((_, idx) => idx !== i))}
                hasDateTime={hasTime && !!dueDate && !!dueTime}
                dueDate={dueDate}
                dueTime={dueTime}
                shortcutKey="R"
              />
            </div>
          </div>

          {/* Existing server reminders (compact list) */}
          {serverReminders.length > 0 && (
            <div className="flex flex-wrap gap-1 px-2">
              {serverReminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3B82F6' }}
                >
                  <Bell size={10} />
                  <span>{format(new Date(r.remind_at), 'dd/MM HH:mm')}</span>
                  <button
                    onClick={() => handleDeleteReminder(r.id)}
                    className="rounded-full p-0.5 transition-colors hover:bg-black/10"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Project */}
          <div className="relative">
            <button
              onClick={() => setShowProjectMenu(!showProjectMenu)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Folder size={15} style={{ color: selectedProject?.color ?? 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-primary)' }}>
                {selectedProject?.name ?? 'Entrada'}
              </span>
              <ChevronDown size={13} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
              <span
                className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                O
              </span>
            </button>
            {showProjectMenu && (
              <DropdownMenu onClose={() => setShowProjectMenu(false)} width={208} maxHeight={192}>
                {flattenProjectTree(buildProjectTree(projects.filter((p) => !p.is_archived))).map(
                  (p) => (
                    <DropdownItem
                      key={p.id}
                      onClick={() => handleProjectChange(p.id)}
                      active={task.project_id === p.id}
                    >
                      {p.depth > 0 && (
                        <span className="flex-shrink-0" style={{ width: p.depth * 12 }} />
                      )}
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="truncate">{p.name}</span>
                    </DropdownItem>
                  ),
                )}
              </DropdownMenu>
            )}
          </div>

          {/* Labels */}
          <div className="relative">
            <button
              onClick={() => setShowLabelMenu(!showLabelMenu)}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-sm transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Tag size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div className="flex flex-1 flex-wrap gap-1">
                {taskLabels.length === 0 ? (
                  <span style={{ color: 'var(--text-muted)' }}>Agregar etiqueta</span>
                ) : (
                  taskLabels.map((label) => (
                    <span
                      key={label.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/app/label/${label.id}`)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          navigate(`/app/label/${label.id}`)
                        }
                      }}
                      className="cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
                      style={{ backgroundColor: label.color + '22', color: label.color }}
                    >
                      {label.name}
                    </span>
                  ))
                )}
              </div>
              <span
                className="mt-0.5 rounded px-1 py-0.5 font-mono text-[9px] leading-none shrink-0"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                E
              </span>
            </button>
            {showLabelMenu && (
              <LabelMenu
                labels={labels}
                selectedIds={taskLabels.map((l) => l.id)}
                onToggle={handleToggleLabel}
                onClose={() => setShowLabelMenu(false)}
              />
            )}
          </div>
        </div>

        {/* Divider */}
        <div
          className={cn('border-t', fullScreen ? 'mx-0' : 'mx-4')}
          style={{ borderColor: 'var(--border-primary)' }}
        />

        {/* Subtasks */}
        <div className={cn('p-4', fullScreen && 'px-0')}>
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Subtareas ({subtasks.length})
          </p>

          <div className="space-y-1">
            {subtasks.map((sub) => (
              <SubtaskRow key={sub.id} task={sub} onOpen={() => openSubtask(sub.id)} />
            ))}
          </div>

          {/* Add subtask */}
          <div className="mt-2 flex items-center gap-2">
            <Plus size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              ref={subtaskInputRef}
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSubtask()
              }}
              placeholder="Agregar subtarea"
              className="flex-1 text-sm outline-none"
              style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
            />
            {newSubtask.trim() ? (
              <button
                onClick={handleAddSubtask}
                className="rounded px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: '#283B56' }}
              >
                Agregar
              </button>
            ) : (
              <span
                className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                N
              </span>
            )}
          </div>
        </div>
      </>
    )

  /* ── Full screen render ── */
  if (fullScreen) {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-6 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={close}
              className="rounded p-1 transition-colors hover:opacity-60"
              style={{ color: 'var(--text-muted)' }}
              title="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Detalle de tarea
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Save button */}
            <button
              onClick={handleSaveMain}
              disabled={!isDirty || saving}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: isDirty ? '#283B56' : 'var(--bg-secondary)',
                color: isDirty ? '#ffffff' : 'var(--text-muted)',
                cursor: isDirty ? 'pointer' : 'default',
              }}
              title="Guardar cambios (Ctrl+S)"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>

            {task && (
              <button
                onClick={() => {
                  showConfirmDialog({
                    title: '¿Eliminar tarea?',
                    message:
                      'Esta acción no se puede deshacer. La tarea y sus subtareas serán eliminadas permanentemente.',
                    onConfirm: () => {
                      deleteTask.mutate(task.id)
                      close()
                    },
                  })
                }}
                className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-4">{content}</div>
        </div>
      </div>
    )
  }

  /* ── Panel render (default) ── */
  return (
    <>
      {/* Backdrop mobile */}
      <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={close} />

      {/* Panel */}
      <aside
        ref={panelRef}
        className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l shadow-xl md:relative md:z-0 md:shadow-none"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          width: `${detailPanelWidth}px`,
          minWidth: '320px',
          maxWidth: '700px',
        }}
      >
        {/* Resize handle (left edge) */}
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 z-10 hidden h-full w-1 cursor-col-resize md:block"
          style={{ marginLeft: '-2px' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-primary)')}
          onMouseLeave={(e) => {
            if (!isDragging.current) e.currentTarget.style.backgroundColor = 'transparent'
          }}
        />
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <div className="flex items-center gap-2">
            {parentStack.length > 0 && (
              <button
                onClick={goBack}
                className="rounded p-1 transition-colors hover:opacity-60"
                style={{ color: 'var(--text-muted)' }}
                title="Volver a la tarea padre"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              {parentStack.length > 0 ? 'Subtarea' : 'Detalle de tarea'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Save button */}
            <button
              onClick={handleSaveMain}
              disabled={!isDirty || saving}
              className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                backgroundColor: isDirty ? '#283B56' : 'var(--bg-secondary)',
                color: isDirty ? '#ffffff' : 'var(--text-muted)',
                cursor: isDirty ? 'pointer' : 'default',
              }}
              title="Guardar cambios (Ctrl+S)"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>

            {effectiveTaskId && (
              <button
                onClick={() => navigate(`/app/task/${effectiveTaskId}`)}
                className="rounded p-1 transition-colors hover:opacity-60"
                style={{ color: 'var(--text-muted)' }}
                title="Abrir en pantalla completa"
              >
                <Maximize2 size={15} />
              </button>
            )}
            {task && (
              <button
                onClick={() => {
                  showConfirmDialog({
                    title: '¿Eliminar tarea?',
                    message:
                      'Esta acción no se puede deshacer. La tarea y sus subtareas serán eliminadas permanentemente.',
                    onConfirm: () => {
                      deleteTask.mutate(task.id)
                      if (parentStack.length > 0) goBack()
                      else close()
                    },
                  })
                }}
                className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={close}
              className="rounded p-1 transition-colors hover:opacity-60"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{content}</div>
      </aside>
    </>
  )
}

/* ── Subtask Row ──────────────────────────────────── */
function SubtaskRow({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const completeTask = useCompleteTask()
  const [completing, setCompleting] = useState(false)

  const handleComplete = (checked: boolean) => {
    setCompleting(checked)
    setTimeout(() => completeTask.mutate({ id: task.id, completed: checked, task }), 300)
  }

  return (
    <div
      className="group flex items-center gap-2 rounded-lg py-1 px-1 transition-colors"
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <TaskCheckbox
        checked={task.is_completed || completing}
        priority={task.priority}
        onChange={handleComplete}
      />
      <button
        onClick={onOpen}
        className={cn(
          'tiptap flex-1 text-left text-sm truncate',
          (task.is_completed || completing) && 'line-through opacity-50',
        )}
        style={{ color: 'var(--text-primary)' }}
        title="Abrir subtarea"
      >
        <span
          dangerouslySetInnerHTML={{
            __html: stripLabelTokensFromHtml(task.title).replace(/^<p>(.*)<\/p>$/, '$1'),
          }}
        />
      </button>
      {task.due_date && (
        <span
          className="shrink-0 flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatRelativeDate(task.due_date)}
          {task.is_recurring && <Repeat size={11} />}
        </span>
      )}
      {task.priority < 4 && (
        <Flag size={12} className="shrink-0" style={{ color: PRIORITY_COLORS[task.priority] }} />
      )}
    </div>
  )
}

function DropdownMenu({
  children,
  onClose,
  width = 160,
  maxHeight,
}: {
  children: React.ReactNode
  onClose: () => void
  width?: number
  maxHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const parentEl = ref.current?.parentElement
    if (!parentEl) return

    const update = () => {
      const rect = parentEl.getBoundingClientRect()
      const vw = window.innerWidth
      let left = rect.left
      if (left + width > vw - 8) left = rect.right - width
      left = Math.max(8, Math.min(left, vw - width - 8))
      setPos({ top: rect.bottom + 4, left })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [width])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="rounded-xl border py-1 shadow-xl"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        width,
        maxHeight,
        overflowY: maxHeight ? 'auto' : undefined,
      }}
    >
      {children}
    </div>
  )
}

function DropdownItem({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
      style={{ color: 'var(--text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
      {active && <Check size={13} className="ml-auto shrink-0" style={{ color: '#283B56' }} />}
    </button>
  )
}

/** Strip p1-p4 priority tokens from HTML (colored spans + plain text). */
function stripPriorityTokens(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  // Remove colored spans containing only a priority token
  div.querySelectorAll('span[style*="color"]').forEach((span) => {
    if (/^p[1-4]$/i.test(span.textContent?.trim() ?? '')) span.remove()
  })
  // Clean remaining plain text priority tokens
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT)
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.textContent ?? ''
    const cleaned = text.replace(/(?:^| )p[1-4](?= |$)/gi, '').replace(/\s+/g, ' ')
    if (cleaned !== text) node.textContent = cleaned
  }
  return div.innerHTML
}

function LabelMenu({
  labels,
  selectedIds,
  onToggle,
  onClose,
}: {
  labels: import('@/lib/types').Label[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const parentEl = ref.current?.parentElement
    if (!parentEl) return

    const update = () => {
      const rect = parentEl.getBoundingClientRect()
      const vw = window.innerWidth
      const menuWidth = 224 // w-56 = 224px
      let left = rect.left
      if (left + menuWidth > vw - 8) left = rect.right - menuWidth
      left = Math.max(8, Math.min(left, vw - menuWidth - 8))
      setPos({ top: rect.bottom + 4, left })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="w-56 rounded-xl border py-1 shadow-xl"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        zIndex: 9999,
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {labels.length === 0 ? (
        <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          No hay etiquetas creadas aún
        </p>
      ) : (
        labels.map((label) => {
          const active = selectedIds.includes(label.id)
          return (
            <button
              key={label.id}
              onClick={() => onToggle(label.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
              <span className="flex-1 text-left">{label.name}</span>
              {active && <Check size={13} style={{ color: '#283B56' }} />}
            </button>
          )
        })
      )}
    </div>
  )
}
