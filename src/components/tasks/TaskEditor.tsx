import { useState, useEffect, useRef } from 'react'
import { Flag, ChevronDown, Hash, X, Check, Plus, Trash2, Pencil } from 'lucide-react'
import { ColorPicker } from '@/components/common/ColorPicker'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useProjects, useInboxProject } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useLabels, useTaskLabels, useCreateLabel, useDeleteLabel, useUpdateLabel, LABEL_COLORS } from '@/hooks/useLabels'
import { useUIStore } from '@/stores/uiStore'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { MarkdownEditor } from './MarkdownEditor'
import type { Task } from '@/lib/types'

interface TaskEditorProps {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultProjectId?: string
  defaultDate?: string | null
}

export function TaskEditor({ open, onClose, task, defaultProjectId, defaultDate }: TaskEditorProps) {
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
  const { showConfirmDialog } = useUIStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(4)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [dueTime, setDueTime] = useState<string | null>(null)
  const [hasTime, setHasTime] = useState(false)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
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

  // Hash autocomplete state
  const [hashQuery, setHashQuery] = useState<string | null>(null)
  const [hashStart, setHashStart] = useState(0)
  const [hashHighlightIdx, setHashHighlightIdx] = useState(0)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return

    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setDueDate(task.due_date ?? null)
      setHasTime(task.has_time)
      setDurationMinutes(task.duration_minutes)
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
    } else {
      setTitle('')
      setDescription('')
      setPriority(4)
      setDueDate(defaultDate ?? null)
      setDueTime(null)
      setHasTime(false)
      setDurationMinutes(null)
      setProjectId(defaultProjectId ?? inboxProject?.id ?? '')
      setSelectedLabelIds([])
    }
    setHashQuery(null)
  }, [task, open, defaultProjectId, defaultDate, inboxProject, existingLabels.length])

  // ── Helper: remove a #labelname token from text ──────────────────────────
  const removeLabelToken = (text: string, labelName: string) => {
    const escaped = labelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return text
      .replace(new RegExp(`#${escaped}(?=\\s|$)`, 'gi'), '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  // ── Confirm a label from hash autocomplete ────────────────────────────────
  const confirmHashLabel = (label: { id: string; name: string; color: string }) => {
    const before = title.slice(0, hashStart)
    const after = title.slice(hashStart + 1 + (hashQuery?.length ?? 0))
    const token = '#' + label.name
    const afterTrimmed = after.trimStart()
    const newTitle = (before + token + (afterTrimmed ? ' ' + afterTrimmed : '')).trimEnd()
    setTitle(newTitle)
    setSelectedLabelIds((prev) => (prev.includes(label.id) ? prev : [...prev, label.id]))
    setHashQuery(null)
    setTimeout(() => {
      const input = titleInputRef.current
      if (input) {
        const pos = Math.min(before.length + token.length + 1, newTitle.length)
        input.focus()
        input.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  // ── Create new label from hash query and confirm ──────────────────────────
  const createAndConfirmHash = async (name: string) => {
    const color = LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)]
    const newLabel = await createLabel.mutateAsync({ name, color })
    confirmHashLabel(newLabel)
  }

  // ── Handle title input change with hash detection ─────────────────────────
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)

    const cursor = e.target.selectionStart ?? val.length
    // Walk back from cursor to find # preceded by nothing or space
    let hashIdx = -1
    for (let i = cursor - 1; i >= 0; i--) {
      if (val[i] === '#') {
        if (i === 0 || val[i - 1] === ' ') {
          hashIdx = i
        }
        break
      }
      if (val[i] === ' ') break
    }

    if (hashIdx !== -1) {
      const query = val.slice(hashIdx + 1, cursor)
      if (!query.includes(' ')) {
        setHashQuery(query)
        setHashStart(hashIdx)
        setHashHighlightIdx(0)
        return
      }
    }
    setHashQuery(null)
  }

  // ── Toggle label with bidirectional title sync ────────────────────────────
  const toggleLabel = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId)
    if (!label) return
    const isSelected = selectedLabelIds.includes(labelId)
    if (isSelected) {
      setSelectedLabelIds((prev) => prev.filter((id) => id !== labelId))
      setTitle((prev) => removeLabelToken(prev, label.name))
    } else {
      setSelectedLabelIds((prev) => [...prev, labelId])
      // Only append if #labelname not already present in title
      const escaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const alreadyInTitle = new RegExp(`#${escaped}(?=\\s|$)`, 'i').test(title)
      if (!alreadyInTitle) {
        setTitle((prev) => {
          const t = prev.trimEnd()
          return t ? t + ' #' + label.name : '#' + label.name
        })
      }
    }
  }

  // ── Remove label chip with title sync ─────────────────────────────────────
  const removeLabel = (labelId: string) => {
    const label = labels.find((l) => l.id === labelId)
    setSelectedLabelIds((prev) => prev.filter((id) => id !== labelId))
    if (label) setTitle((prev) => removeLabelToken(prev, label.name))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!title.trim() || !user) return
    const targetProjectId = projectId || inboxProject?.id
    if (!targetProjectId) return

    let cleanTitle = title.trim()

    // Auto-select any #labelname tokens that match existing labels
    const finalLabelIds = [...selectedLabelIds]
    for (const label of labels) {
      const escaped = label.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (
        new RegExp(`#${escaped}(?=\\s|$)`, 'i').test(cleanTitle) &&
        !finalLabelIds.includes(label.id)
      ) {
        finalLabelIds.push(label.id)
      }
    }

    // Strip all #labelname tokens for final selected labels
    for (const labelId of finalLabelIds) {
      const label = labels.find((l) => l.id === labelId)
      if (label) cleanTitle = removeLabelToken(cleanTitle, label.name)
    }

    if (!cleanTitle) return

    let dueDatetime: string | null = null
    if (dueDate && hasTime && dueTime) {
      dueDatetime = new Date(`${dueDate}T${dueTime}:00`).toISOString()
    }

    if (task) {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          title: cleanTitle,
          description: description || null,
          priority,
          due_date: dueDate || null,
          due_datetime: dueDatetime,
          has_time: hasTime,
          duration_minutes: durationMinutes,
          project_id: targetProjectId,
          label_ids: finalLabelIds,
        },
      })
    } else {
      await createTask.mutateAsync({
        user_id: user.id,
        project_id: targetProjectId,
        title: cleanTitle,
        description: description || null,
        priority,
        due_date: dueDate || null,
        due_datetime: dueDatetime,
        has_time: hasTime,
        duration_minutes: durationMinutes,
        label_ids: finalLabelIds,
      })
    }

    onClose()
  }

  if (!open) return null

  const selectedProject = projects.find((p) => p.id === projectId) ?? inboxProject
  const selectedLabels = labels.filter((l) => selectedLabelIds.includes(l.id))
  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(labelSearch.toLowerCase()),
  )

  // Title parts for highlighted rendering
  const titleParts = (() => {
    const parts: { text: string; color?: string }[] = []
    const regex = /#(\S+)/g
    let match: RegExpExecArray | null
    let lastIndex = 0
    while ((match = regex.exec(title)) !== null) {
      const start = match.index
      const word = match[1]
      const fullToken = match[0]
      if (start > lastIndex) parts.push({ text: title.slice(lastIndex, start) })
      const matchedLabel = labels.find(
        (l) => selectedLabelIds.includes(l.id) && l.name.toLowerCase() === word.toLowerCase(),
      )
      const isActiveHash = hashQuery !== null && start === hashStart
      const color = matchedLabel ? matchedLabel.color : isActiveHash ? '#283B56' : undefined
      parts.push({ text: fullToken, color })
      lastIndex = start + fullToken.length
    }
    if (lastIndex < title.length) parts.push({ text: title.slice(lastIndex) })
    return parts
  })()

  // Hash autocomplete
  const hashFilteredLabels =
    hashQuery !== null
      ? labels.filter((l) => l.name.toLowerCase().includes(hashQuery.toLowerCase()))
      : []
  const showHashCreate =
    hashQuery !== null &&
    hashQuery.trim() !== '' &&
    !labels.some((l) => l.name.toLowerCase() === hashQuery.trim().toLowerCase())
  const hashTotalItems = hashFilteredLabels.length + (showHashCreate ? 1 : 0)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        <div className="p-4">
          {/* Title with hash autocomplete */}
          <div className="relative">
            {/* Mirror div for colored #token rendering */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-sm font-medium leading-normal"
            >
              {title === '' ? (
                <span style={{ color: 'var(--text-muted)' }}>Nombre de la tarea</span>
              ) : (
                titleParts.map((part, i) =>
                  part.color ? (
                    <span key={i} style={{ color: part.color, fontWeight: 500 }}>{part.text}</span>
                  ) : (
                    <span key={i} style={{ color: 'var(--text-primary)' }}>{part.text}</span>
                  ),
                )
              )}
            </div>
            <input
              ref={titleInputRef}
              autoFocus
              value={title}
              onChange={handleTitleChange}
              className="relative w-full text-sm font-medium leading-normal outline-none"
              style={{ backgroundColor: 'transparent', color: 'transparent', caretColor: 'var(--text-primary)' }}
              placeholder=""
              onKeyDown={(e) => {
                if (hashQuery !== null && hashTotalItems > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setHashHighlightIdx((prev) => (prev + 1) % hashTotalItems)
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setHashHighlightIdx((prev) => (prev - 1 + hashTotalItems) % hashTotalItems)
                    return
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (hashHighlightIdx < hashFilteredLabels.length) {
                      confirmHashLabel(hashFilteredLabels[hashHighlightIdx])
                    } else if (showHashCreate && hashQuery.trim()) {
                      createAndConfirmHash(hashQuery.trim())
                    }
                    return
                  }
                  if (e.key === 'Escape') {
                    setHashQuery(null)
                    return
                  }
                } else {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                  if (e.key === 'Escape') onClose()
                }
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
                      <Check size={11} style={{ color: '#283B56' }} />
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
                            ? 'rgba(40,59,86,0.1)'
                            : 'rgba(40,59,86,0.04)',
                        color: '#283B56',
                      }}
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      Crear «<span className="font-semibold">{hashQuery.trim()}</span>»
                    </button>
                  </div>
                )}
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
              onDateChange={setDueDate}
              onTimeChange={setDueTime}
              onHasTimeChange={setHasTime}
              onDurationChange={setDurationMinutes}
            />

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <Flag size={12} style={{ color: PRIORITY_COLORS[priority] }} />
                {PRIORITY_LABELS[priority]}
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
                      <Flag size={14} style={{ color: PRIORITY_COLORS[p] }} />
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
                  className="absolute left-0 top-full z-20 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
                  style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                >
                  {projects.filter((p) => !p.is_archived).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setProjectId(p.id); setShowProjectMenu(false) }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                      <span className="truncate">{p.name}</span>
                      {projectId === p.id && <Check size={12} className="ml-auto" style={{ color: '#283B56' }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Labels */}
            <div className="relative">
              <button
                onClick={() => setShowLabelMenu(!showLabelMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <Hash size={12} />
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
                              backgroundColor: 'rgba(40,59,86,0.04)',
                              color: '#283B56',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,59,86,0.1)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(40,59,86,0.04)')}
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
            disabled={!title.trim() || createTask.isPending || updateTask.isPending}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#283B56' }}
          >
            {task ? 'Guardar' : 'Agregar tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}
