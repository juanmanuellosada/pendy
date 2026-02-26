import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Sun,
  Sofa,
  ArrowRight,
  Circle,
  MoreHorizontal,
  Flag,
  AlarmClock,
  Bell,
  FolderInput,
  Copy,
  Link2,
  ExternalLink,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react'
import { format, addDays, nextSaturday, getDay } from 'date-fns'
import { useUpdateTask, useDeleteTask, useCreateTask } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useProjectSections } from '@/hooks/useSections'
import { useUIStore } from '@/stores/uiStore'
import { useAuth } from '@/hooks/useAuth'
import { useCreateReminder } from '@/hooks/useReminders'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { DeadlinePicker } from '@/components/common/DeadlinePicker'
import { ReminderPicker, resolveReminderConfig } from '@/components/common/ReminderPicker'
import type { ReminderConfig } from '@/components/common/ReminderPicker'
import type { Task } from '@/lib/types'

interface TaskContextMenuProps {
  task: Task
  x: number
  y: number
  onClose: () => void
}

const DAY_NAMES_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

export function TaskContextMenu({ task, x, y, onClose }: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createTask = useCreateTask()
  const { data: projects = [] } = useProjects()
  const { showConfirmDialog } = useUIStore()
  const { user } = useAuth()

  const createReminder = useCreateReminder()

  // Submenu state
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const [showSectionSubmenu, setShowSectionSubmenu] = useState<string | null>(null) // project id
  const moveRef = useRef<HTMLDivElement>(null)

  // Inline panel state
  const [activePanel, setActivePanel] = useState<'date' | 'deadline' | 'reminder' | null>(null)

  // Local task state for inline pickers
  const [localDate, setLocalDate] = useState(task.due_date ?? null)
  const [localTime, setLocalTime] = useState<string | null>(() => {
    if (task.has_time && task.due_datetime) {
      const d = new Date(task.due_datetime)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    return null
  })
  const [localHasTime, setLocalHasTime] = useState(task.has_time)
  const [localDuration, setLocalDuration] = useState<number | null>(task.duration_minutes)
  const [localIsRecurring, setLocalIsRecurring] = useState(task.is_recurring)
  const [localRecurrenceRule, setLocalRecurrenceRule] = useState<string | null>(task.recurrence_rule ?? null)
  const [localRecurrenceFrom, setLocalRecurrenceFrom] = useState<'due_date' | 'completion_date'>(task.recurrence_from ?? 'due_date')
  const [localDeadline, setLocalDeadline] = useState<string | null>(task.deadline ?? null)

  // Adjust position so menu doesn't go off-screen
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let nx = x
    let ny = y
    if (x + rect.width > vw - 8) nx = vw - rect.width - 8
    if (y + rect.height > vh - 8) ny = vh - rect.height - 8
    if (nx < 8) nx = 8
    if (ny < 8) ny = 8
    setPos({ x: nx, y: ny })
  }, [x, y])

  // Close on outside click / escape
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Slight delay to avoid the same mousedown that opened the menu from closing it
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler)
    }, 50)
    document.addEventListener('keydown', keyHandler)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  /* ── Date shortcuts ── */
  const today = new Date()
  const weekend = nextSaturday(today)
  const dayOfWeek = getDay(today)
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextWeek = addDays(today, daysUntilMonday)

  const dateShortcuts = [
    {
      icon: Sun,
      color: '#22C55E',
      label: 'Hoy',
      hint: DAY_NAMES_SHORT[getDay(today)],
      date: format(today, 'yyyy-MM-dd'),
    },
    {
      icon: Sofa,
      color: '#3B82F6',
      label: 'Fin de semana',
      hint: format(weekend, 'd MMM'),
      date: format(weekend, 'yyyy-MM-dd'),
    },
    {
      icon: ArrowRight,
      color: '#8B5CF6',
      label: 'Próx. semana',
      hint: format(nextWeek, 'd MMM'),
      date: format(nextWeek, 'yyyy-MM-dd'),
    },
    {
      icon: Circle,
      color: 'var(--text-muted)',
      label: 'Sin fecha',
      hint: '',
      date: null,
    },
  ]

  const handleSetDate = (date: string | null) => {
    updateTask.mutate({ id: task.id, updates: { due_date: date } })
    onClose()
  }

  const handleSetPriority = (p: 1 | 2 | 3 | 4) => {
    updateTask.mutate({ id: task.id, updates: { priority: p } })
    onClose()
  }

  const handleDelete = () => {
    onClose()
    showConfirmDialog({
      title: '¿Eliminar tarea?',
      message: 'Esta acción no se puede deshacer. La tarea será eliminada permanentemente.',
      onConfirm: () => deleteTask.mutate(task.id),
    })
  }

  const handleDuplicate = () => {
    if (!user) return
    onClose()
    createTask.mutate({
      user_id: user.id,
      project_id: task.project_id,
      section_id: task.section_id,
      parent_id: task.parent_id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      due_date: task.due_date,
      due_datetime: task.due_datetime,
      has_time: task.has_time,
      duration_minutes: task.duration_minutes,
    })
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/app/task/${task.id}`
    navigator.clipboard.writeText(url).catch(() => {})
    onClose()
  }

  const handleOpenNewWindow = () => {
    window.open(`${window.location.origin}/app/task/${task.id}`, '_blank')
    onClose()
  }

  /* ── Inline picker handlers ── */
  const handleInlineDateChange = (date: string | null) => {
    setLocalDate(date)
    updateTask.mutate({ id: task.id, updates: { due_date: date } })
  }

  const handleInlineTimeChange = (time: string | null) => {
    setLocalTime(time)
    if (time && localDate) {
      const dt = new Date(`${localDate}T${time}:00`)
      updateTask.mutate({ id: task.id, updates: { due_datetime: dt.toISOString() } })
    } else {
      updateTask.mutate({ id: task.id, updates: { due_datetime: null } })
    }
  }

  const handleInlineHasTimeChange = (ht: boolean) => {
    setLocalHasTime(ht)
    if (!ht) {
      setLocalTime(null)
      updateTask.mutate({ id: task.id, updates: { has_time: false, due_datetime: null } })
    } else {
      updateTask.mutate({ id: task.id, updates: { has_time: true } })
    }
  }

  const handleInlineDurationChange = (min: number | null) => {
    setLocalDuration(min)
    updateTask.mutate({ id: task.id, updates: { duration_minutes: min } })
  }

  const handleInlineRecurrenceChange = (recurring: boolean, rule: string | null, from: 'due_date' | 'completion_date') => {
    setLocalIsRecurring(recurring)
    setLocalRecurrenceRule(rule)
    setLocalRecurrenceFrom(from)
    updateTask.mutate({ id: task.id, updates: { is_recurring: recurring, recurrence_rule: rule, recurrence_from: from } })
  }

  const handleInlineDeadlineChange = (dl: string | null) => {
    setLocalDeadline(dl)
    updateTask.mutate({ id: task.id, updates: { deadline: dl } })
  }

  const handleInlineAddReminder = async (config: ReminderConfig) => {
    if (!user) return
    const remindAt = resolveReminderConfig(config, localDate, localTime)
    if (!remindAt) return
    await createReminder.mutateAsync({
      task_id: task.id,
      remind_at: remindAt,
    })
  }

  const handleMoveTo = (projectId: string, sectionId?: string | null) => {
    updateTask.mutate({
      id: task.id,
      updates: { project_id: projectId, section_id: sectionId ?? null },
    })
    onClose()
  }

  const regularProjects = projects.filter((p) => !p.is_archived)

  const panelTitle = activePanel === 'date' ? 'Fecha' : activePanel === 'deadline' ? 'Fecha límite' : activePanel === 'reminder' ? 'Recordatorios' : ''
  const menuWidth = activePanel === 'reminder' ? 340 : activePanel ? 288 : 256

  const menu = (
    <div
      ref={menuRef}
      className="rounded-xl border shadow-2xl select-none"
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        zIndex: 99999,
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        width: menuWidth,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        transition: 'width 0.15s ease',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Inline Panel Header (back button) ── */}
      {activePanel && (
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={() => setActivePanel(null)}
            className="rounded p-1 transition-colors"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronLeft size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {panelTitle}
          </span>
        </div>
      )}

      {/* ── Inline Panels ── */}
      {activePanel === 'date' && (
        <DateTimePicker
          inline
          date={localDate}
          time={localTime}
          hasTime={localHasTime}
          durationMinutes={localDuration}
          isRecurring={localIsRecurring}
          recurrenceRule={localRecurrenceRule}
          recurrenceFrom={localRecurrenceFrom}
          onDateChange={handleInlineDateChange}
          onTimeChange={handleInlineTimeChange}
          onHasTimeChange={handleInlineHasTimeChange}
          onDurationChange={handleInlineDurationChange}
          onRecurrenceChange={handleInlineRecurrenceChange}
        />
      )}

      {activePanel === 'deadline' && (
        <DeadlinePicker
          inline
          deadline={localDeadline}
          onDeadlineChange={handleInlineDeadlineChange}
        />
      )}

      {activePanel === 'reminder' && (
        <ReminderPicker
          inline
          reminders={[]}
          onAdd={handleInlineAddReminder}
          onRemove={() => {}}
          hasDateTime={localHasTime && !!localDate && !!localTime}
          dueDate={localDate}
          dueTime={localTime}
        />
      )}

      {/* ── Regular Menu ── */}
      {!activePanel && (
        <div className="py-1.5">
          {/* ── Fecha ── */}
          <div className="px-3 py-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Fecha
              </span>
              <span
                className="rounded px-1 py-0.5 font-mono text-[9px]"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                T
              </span>
            </div>
            <div className="flex items-center gap-1">
              {dateShortcuts.map(({ icon: Icon, color, label, date }) => (
                <button
                  key={label}
                  onClick={() => handleSetDate(date)}
                  title={label}
                  className="flex flex-1 items-center justify-center rounded-lg p-2 transition-colors"
                  style={{
                    backgroundColor:
                      task.due_date === date && date !== null
                        ? color + '22'
                        : 'var(--bg-secondary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = color + '22')}
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      task.due_date === date && date !== null ? color + '22' : 'var(--bg-secondary)')
                  }
                >
                  <Icon size={15} style={{ color }} />
                </button>
              ))}
              <button
                onClick={() => setActivePanel('date')}
                title="Más opciones de fecha"
                className="flex flex-1 items-center justify-center rounded-lg p-2 transition-colors"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
              >
                <MoreHorizontal size={15} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>

          {/* ── Prioridad ── */}
          <div className="px-3 py-1.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Prioridad
              </span>
              <span
                className="rounded px-1 py-0.5 font-mono text-[9px]"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
              >
                Y
              </span>
            </div>
            <div className="flex items-center gap-1">
              {([1, 2, 3, 4] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleSetPriority(p)}
                  title={PRIORITY_LABELS[p]}
                  className="flex flex-1 items-center justify-center rounded-lg p-2 transition-colors relative"
                  style={{
                    backgroundColor:
                      task.priority === p
                        ? PRIORITY_COLORS[p] + '22'
                        : 'var(--bg-secondary)',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = PRIORITY_COLORS[p] + '22')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      task.priority === p ? PRIORITY_COLORS[p] + '22' : 'var(--bg-secondary)')
                  }
                >
                  <Flag size={15} style={{ color: PRIORITY_COLORS[p] }} />
                  {task.priority === p && (
                    <span
                      className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: PRIORITY_COLORS[p],
                        borderColor: 'var(--bg-primary)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="my-1 mx-2 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* ── Fecha límite ── */}
          <MenuItem icon={AlarmClock} label="Fecha límite" onClick={() => setActivePanel('deadline')} />

          {/* ── Recordatorios ── */}
          <MenuItem icon={Bell} label="Recordatorios" onClick={() => setActivePanel('reminder')} />

          <div className="my-1 mx-2 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* ── Mover a... ── */}
          <div
            ref={moveRef}
            className="relative"
            onMouseEnter={() => setShowMoveSubmenu(true)}
            onMouseLeave={() => {
              setShowMoveSubmenu(false)
              setShowSectionSubmenu(null)
            }}
          >
            <MenuItem
              icon={FolderInput}
              label="Mover a..."
              shortcut="V"
              rightIcon={ChevronRight}
              active={showMoveSubmenu}
            />
            {showMoveSubmenu && (
              <MoveSubmenu
                task={task}
                projects={regularProjects}
                showSectionSubmenu={showSectionSubmenu}
                setShowSectionSubmenu={setShowSectionSubmenu}
                onMoveTo={handleMoveTo}
              />
            )}
          </div>

          {/* ── Duplicar ── */}
          <MenuItem icon={Copy} label="Duplicar" onClick={handleDuplicate} />

          {/* ── Copiar enlace ── */}
          <MenuItem
            icon={Link2}
            label="Copiar enlace a la tarea"
            shortcut="⇧Ctrl C"
            onClick={handleCopyLink}
          />

          {/* ── Abrir en nueva ventana ── */}
          <MenuItem
            icon={ExternalLink}
            label="Abrir en una nueva ventana"
            shortcut="Ctrl ⇧ N"
            onClick={handleOpenNewWindow}
          />

          <div className="my-1 mx-2 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* ── Eliminar ── */}
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors"
            style={{ color: '#EC1E2A' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(236,30,42,0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Trash2 size={15} />
            <span className="flex-1 text-left">Eliminar</span>
            <span className="text-xs opacity-60">⇧ Elim</span>
          </button>
        </div>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}

/* ── MenuItem ── */
function MenuItem({
  icon: Icon,
  label,
  shortcut,
  rightIcon: RightIcon,
  onClick,
  active,
}: {
  icon: React.ElementType
  label: string
  shortcut?: string
  rightIcon?: React.ElementType
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors"
      style={{
        color: 'var(--text-primary)',
        backgroundColor: active ? 'var(--bg-hover)' : 'transparent',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = active ? 'var(--bg-hover)' : 'transparent')
      }
    >
      <Icon size={15} style={{ color: 'var(--text-secondary)' }} />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {shortcut}
        </span>
      )}
      {RightIcon && <RightIcon size={13} style={{ color: 'var(--text-muted)' }} />}
    </button>
  )
}

/* ── Move Submenu ── */
function MoveSubmenu({
  task,
  projects,
  showSectionSubmenu,
  setShowSectionSubmenu,
  onMoveTo,
}: {
  task: Task
  projects: import('@/lib/types').Project[]
  showSectionSubmenu: string | null
  setShowSectionSubmenu: (id: string | null) => void
  onMoveTo: (projectId: string, sectionId?: string | null) => void
}) {
  return (
    <div
      className="absolute left-full top-0 rounded-xl border shadow-2xl py-1.5"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        width: 220,
        zIndex: 100000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        marginLeft: 4,
      }}
    >
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Proyectos
      </p>
      {projects.map((project) => (
        <div
          key={project.id}
          className="relative"
          onMouseEnter={() => setShowSectionSubmenu(project.id)}
        >
          <button
            onClick={() => onMoveTo(project.id, null)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: task.project_id === project.id ? 'var(--bg-hover)' : 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor =
                task.project_id === project.id ? 'var(--bg-hover)' : 'transparent')
            }
          >
            <span
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: project.color }}
            />
            <span className="flex-1 truncate text-left">{project.name}</span>
            {task.project_id === project.id && (
              <Check size={12} style={{ color: '#283B56' }} />
            )}
            <SectionIndicator projectId={project.id} />
          </button>
          {showSectionSubmenu === project.id && (
            <SectionSubmenu
              projectId={project.id}
              currentSectionId={task.project_id === project.id ? task.section_id : null}
              onMoveTo={(sectionId) => onMoveTo(project.id, sectionId)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Section indicator (chevron if project has sections) ── */
function SectionIndicator({ projectId }: { projectId: string }) {
  const { data: sections = [] } = useProjectSections(projectId)
  if (sections.length === 0) return null
  return <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
}

/* ── Section submenu ── */
function SectionSubmenu({
  projectId,
  currentSectionId,
  onMoveTo,
}: {
  projectId: string
  currentSectionId: string | null
  onMoveTo: (sectionId: string | null) => void
}) {
  const { data: sections = [] } = useProjectSections(projectId)

  return (
    <div
      className="absolute left-full top-0 rounded-xl border shadow-2xl py-1.5"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        width: 200,
        zIndex: 100001,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        marginLeft: 4,
      }}
    >
      <button
        onClick={() => onMoveTo(null)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
        style={{
          color: 'var(--text-primary)',
          backgroundColor: currentSectionId === null ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor =
            currentSectionId === null ? 'var(--bg-hover)' : 'transparent')
        }
      >
        <span className="flex-1 text-left" style={{ color: 'var(--text-muted)' }}>
          Sin sección
        </span>
        {currentSectionId === null && <Check size={12} style={{ color: '#283B56' }} />}
      </button>
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onMoveTo(section.id)}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors"
          style={{
            color: 'var(--text-primary)',
            backgroundColor: currentSectionId === section.id ? 'var(--bg-hover)' : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor =
              currentSectionId === section.id ? 'var(--bg-hover)' : 'transparent')
          }
        >
          <span className="flex-1 truncate text-left">{section.name}</span>
          {currentSectionId === section.id && <Check size={12} style={{ color: '#283B56' }} />}
        </button>
      ))}
    </div>
  )
}
