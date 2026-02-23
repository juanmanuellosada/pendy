import { useState, useEffect, useRef } from 'react'
import {
  X,
  Flag,
  ChevronDown,
  Folder,
  Plus,
  Check,
  Hash,
  Trash2,
  Clock,
  Timer,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useUIStore } from '@/stores/uiStore'
import { useTask, useSubtasks, useUpdateTask, useCreateTask, useCompleteTask, useDeleteTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useTaskLabels, useLabels, useSetTaskLabels } from '@/hooks/useLabels'
import { useAuth } from '@/hooks/useAuth'
import { TaskCheckbox } from './TaskCheckbox'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { formatRelativeDate } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Task } from '@/lib/types'

export function TaskDetail() {
  const { selectedTaskId, setSelectedTaskId } = useAppStore()
  const { showConfirmDialog } = useUIStore()
  const { data: task, isLoading } = useTask(selectedTaskId)
  const { data: subtasks = [] } = useSubtasks(selectedTaskId)
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()
  const { data: taskLabels = [] } = useTaskLabels(selectedTaskId ?? '')
  const { user } = useAuth()
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const setTaskLabels = useSetTaskLabels()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showLabelMenu, setShowLabelMenu] = useState(false)
  const [showDateMenu, setShowDateMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
    }
  }, [task?.id])

  if (!selectedTaskId) return null

  const close = () => setSelectedTaskId(null)

  const save = async (updates: Partial<Task> & { label_ids?: string[] }) => {
    if (!task) return
    setSaving(true)
    await updateTask.mutateAsync({ id: task.id, updates })
    setSaving(false)
  }

  const handleTitleBlur = () => {
    if (task && title.trim() && title.trim() !== task.title) {
      save({ title: title.trim() })
    }
  }

  const handleDescriptionBlur = () => {
    if (task && description !== (task.description ?? '')) {
      save({ description: description || null })
    }
  }

  const handleToggleLabel = (labelId: string) => {
    if (!task) return
    const currentIds = taskLabels.map((l) => l.id)
    const next = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId]
    setTaskLabels.mutate({ taskId: task.id, labelIds: next })
  }

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

  const handleSetDate = (dateStr: string | null) => {
    save({ due_date: dateStr })
    setShowDateMenu(false)
  }

  const selectedProject = projects.find((p) => p.id === task?.project_id)

  const quickDates = [
    { label: 'Hoy', value: format(new Date(), 'yyyy-MM-dd') },
    { label: 'Mañana', value: format(addDays(new Date(), 1), 'yyyy-MM-dd') },
    { label: 'Próxima semana', value: format(addDays(new Date(), 7), 'yyyy-MM-dd') },
  ]

  return (
    <>
      {/* Backdrop mobile */}
      <div
        className="fixed inset-0 z-30 bg-black/20 md:hidden"
        onClick={close}
      />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l shadow-xl md:relative md:z-0 md:w-96 md:shadow-none"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          maxWidth: '420px',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Detalle de tarea
          </span>
          <div className="flex items-center gap-2">
            {task && (
              <button
                onClick={() => {
                  showConfirmDialog({
                    title: '¿Eliminar tarea?',
                    message: 'Esta acción no se puede deshacer. La tarea y sus subtareas serán eliminadas permanentemente.',
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
        <div className="flex-1 overflow-y-auto">
          {isLoading || !task ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
              ))}
            </div>
          ) : (
            <>
              {/* Title + checkbox */}
              <div className="flex items-start gap-3 p-4 pb-0">
                <div className="pt-1.5">
                  <TaskCheckbox
                    checked={task.is_completed}
                    priority={task.priority}
                    onChange={(checked) => completeTask.mutate({ id: task.id, completed: checked })}
                  />
                </div>
                <textarea
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  rows={2}
                  className={cn(
                    'flex-1 resize-none text-base font-medium leading-snug outline-none',
                    task.is_completed && 'line-through opacity-50',
                  )}
                  style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                />
              </div>

              {/* Description */}
              <div className="px-4 pb-2 pt-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  rows={3}
                  placeholder="Agregar descripción..."
                  className="w-full resize-none text-sm outline-none"
                  style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
                />
              </div>

              {/* Divider */}
              <div className="mx-4 border-t" style={{ borderColor: 'var(--border-primary)' }} />

              {/* Properties */}
              <div className="space-y-1 p-4">
                {/* Due date */}
                <div className="relative">
                  <button
                    onClick={() => setShowDateMenu(!showDateMenu)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ color: task.due_date ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {task.due_date ? formatRelativeDate(task.due_date) : 'Agregar fecha límite'}
                    </span>
                    {task.due_date && (
                      <button
                        onClick={(e) => { e.stopPropagation(); save({ due_date: null }) }}
                        className="ml-auto rounded p-0.5 hover:opacity-60"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </button>
                  {showDateMenu && (
                    <div
                      className="absolute left-0 top-full z-20 mt-1 w-52 rounded-xl border py-2 shadow-xl"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    >
                      {quickDates.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => handleSetDate(d.value)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {d.label}
                          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                            {format(new Date(d.value + 'T12:00:00'), 'EEE d MMM', { locale: es })}
                          </span>
                        </button>
                      ))}
                      <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
                      <div className="px-3 py-1">
                        <input
                          type="date"
                          onChange={(e) => handleSetDate(e.target.value || null)}
                          className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-primary)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                  <Timer size={15} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Duración</span>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    defaultValue={task.duration_minutes ?? ''}
                    placeholder="min"
                    className="ml-auto w-20 rounded-lg border px-2 py-1 text-xs outline-none text-right"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value)
                      save({ duration_minutes: isNaN(val) ? null : val })
                    }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min</span>
                </div>

                {/* Priority */}
                <div className="relative">
                  <button
                    onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Flag size={15} style={{ color: PRIORITY_COLORS[task.priority] }} />
                    <span style={{ color: 'var(--text-primary)' }}>{PRIORITY_LABELS[task.priority]}</span>
                    <ChevronDown size={13} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                  </button>
                  {showPriorityMenu && (
                    <div
                      className="absolute left-0 top-full z-20 mt-1 w-40 rounded-xl border py-1 shadow-xl"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    >
                      {([1, 2, 3, 4] as const).map((p) => (
                        <button
                          key={p}
                          onClick={() => { save({ priority: p }); setShowPriorityMenu(false) }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Flag size={14} style={{ color: PRIORITY_COLORS[p] }} />
                          {PRIORITY_LABELS[p]}
                          {task.priority === p && <Check size={13} className="ml-auto" style={{ color: '#283B56' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Project */}
                <div className="relative">
                  <button
                    onClick={() => setShowProjectMenu(!showProjectMenu)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Folder size={15} style={{ color: selectedProject?.color ?? 'var(--text-muted)' }} />
                    <span style={{ color: 'var(--text-primary)' }}>{selectedProject?.name ?? 'Entrada'}</span>
                    <ChevronDown size={13} className="ml-auto" style={{ color: 'var(--text-muted)' }} />
                  </button>
                  {showProjectMenu && (
                    <div
                      className="absolute left-0 top-full z-20 mt-1 max-h-48 w-52 overflow-y-auto rounded-xl border py-1 shadow-xl"
                      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
                    >
                      {projects.filter((p) => !p.is_archived).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { save({ project_id: p.id }); setShowProjectMenu(false) }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                          <span className="truncate">{p.name}</span>
                          {task.project_id === p.id && <Check size={13} className="ml-auto" style={{ color: '#283B56' }} />}
                        </button>
                      ))}
                    </div>
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
                    <Hash size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <div className="flex flex-1 flex-wrap gap-1">
                      {taskLabels.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>Agregar etiqueta</span>
                      ) : (
                        taskLabels.map((label) => (
                          <span
                            key={label.id}
                            className="rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: label.color + '22', color: label.color }}
                          >
                            {label.name}
                          </span>
                        ))
                      )}
                    </div>
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
              <div className="mx-4 border-t" style={{ borderColor: 'var(--border-primary)' }} />

              {/* Subtasks */}
              <div className="p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Subtareas ({subtasks.length})
                </p>

                <div className="space-y-1">
                  {subtasks.map((sub) => (
                    <SubtaskRow key={sub.id} task={sub} />
                  ))}
                </div>

                {/* Add subtask */}
                <div className="mt-2 flex items-center gap-2">
                  <Plus size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubtask()
                    }}
                    placeholder="Agregar subtarea"
                    className="flex-1 text-sm outline-none"
                    style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
                  />
                  {newSubtask.trim() && (
                    <button
                      onClick={handleAddSubtask}
                      className="rounded px-2 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: '#283B56' }}
                    >
                      Agregar
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {saving && (
          <div
            className="border-t px-4 py-2 text-xs"
            style={{ borderColor: 'var(--border-primary)', color: 'var(--text-muted)' }}
          >
            Guardando...
          </div>
        )}
      </aside>
    </>
  )
}

function SubtaskRow({ task }: { task: Task }) {
  const completeTask = useCompleteTask()
  const [completing, setCompleting] = useState(false)

  const handleComplete = (checked: boolean) => {
    setCompleting(checked)
    setTimeout(() => completeTask.mutate({ id: task.id, completed: checked }), 300)
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <TaskCheckbox
        checked={task.is_completed || completing}
        priority={task.priority}
        onChange={handleComplete}
      />
      <span
        className={cn('text-sm', (task.is_completed || completing) && 'line-through opacity-50')}
        style={{ color: 'var(--text-primary)' }}
      >
        {task.title}
      </span>
    </div>
  )
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
      className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border py-1 shadow-xl"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
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
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="flex-1 text-left">{label.name}</span>
              {active && <Check size={13} style={{ color: '#283B56' }} />}
            </button>
          )
        })
      )}
    </div>
  )
}

