import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  X,
  Trash2,
  FolderOpen,
  Flag,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  CalendarDays,
  Circle,
} from 'lucide-react'
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { useProjects } from '@/hooks/useProjects'
import { useAllSections } from '@/hooks/useSections'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { buildProjectTree, flattenProjectTree } from '@/lib/projectTree'

const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

/** Mini calendario solo para selección de fecha (sin hora ni recurrencia) */
function MiniDatePicker({ onSelect }: { onSelect: (date: string | null) => void }) {
  const today = useMemo(() => new Date(), [])
  const [viewMonth, setViewMonth] = useState<Date>(today)

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [viewMonth])

  const handleDay = useCallback(
    (day: Date) => {
      onSelect(format(day, 'yyyy-MM-dd'))
      if (!isSameMonth(day, viewMonth)) setViewMonth(day)
    },
    [onSelect, viewMonth],
  )

  const shortcuts = [
    {
      icon: Sun,
      label: 'Hoy',
      hint: format(today, 'EEE', { locale: es }),
      color: '#22C55E',
      action: () => onSelect(format(today, 'yyyy-MM-dd')),
    },
    {
      icon: CalendarDays,
      label: 'Mañana',
      hint: format(addDays(today, 1), 'EEE', { locale: es }),
      color: '#F59E0B',
      action: () => onSelect(format(addDays(today, 1), 'yyyy-MM-dd')),
    },
    {
      icon: Circle,
      label: 'Sin fecha',
      hint: '',
      color: 'var(--text-muted)',
      action: () => onSelect(null),
    },
  ]

  return (
    <div className="py-1">
      {/* Atajos rápidos */}
      {shortcuts.map(({ icon: Icon, label, hint, color, action }) => (
        <button
          key={label}
          onClick={action}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors hover-bg-hover"
          style={{ color: 'var(--text-primary)' }}
        >
          <Icon size={14} style={{ color }} />
          <span className="flex-1 text-left text-xs">{label}</span>
          {hint && (
            <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
              {hint}
            </span>
          )}
        </button>
      ))}

      <div className="mx-2 my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />

      {/* Navegación de mes */}
      <div className="flex items-center justify-between px-2 pb-1">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="rounded p-1 transition-colors hover-bg-hover"
        >
          <ChevronLeft size={13} style={{ color: 'var(--text-primary)' }} />
        </button>
        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
          {format(viewMonth, 'MMMM yyyy', { locale: es })}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded p-1 transition-colors hover-bg-hover"
        >
          <ChevronRight size={13} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>

      {/* Cabeceras de días */}
      <div className="grid grid-cols-7 px-2 text-center">
        {DAY_HEADERS.map((d) => (
          <span
            key={d}
            className="py-0.5 text-[10px] font-medium"
            style={{ color: 'var(--text-muted)' }}
          >
            {d}
          </span>
        ))}
      </div>

      {/* Grilla del calendario */}
      <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-2 text-center">
        {calendarDays.map((day) => {
          const isToday = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, viewMonth)
          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDay(day)}
              className="relative flex flex-col items-center justify-center rounded-md py-1 text-xs transition-colors hover-bg-hover"
              style={{
                color: isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isToday ? 700 : undefined,
              }}
            >
              {format(day, 'd')}
              {isToday && (
                <span
                  className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type ActiveMenu = 'project' | 'priority' | 'date' | null

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  allSelected: boolean
  onSelectAll: () => void
  onClearAll: () => void
  onExit: () => void
  onDelete: () => void
  // Optional task-only actions
  onMoveToProject?: (projectId: string, sectionId: string | null) => void
  onChangePriority?: (priority: 1 | 2 | 3 | 4) => void
  onChangeDueDate?: (date: string | null) => void
  // Label used in count display: defaults to "tarea(s)"
  itemLabel?: string
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  allSelected,
  onSelectAll,
  onClearAll,
  onExit,
  onDelete,
  onMoveToProject,
  onChangePriority,
  onChangeDueDate,
  itemLabel = 'tarea',
}: BulkActionBarProps) {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const { data: projects = [] } = useProjects()
  const { data: sectionsMap } = useAllSections()
  const regularProjects = projects.filter((p) => !p.is_archived)

  const isTaskMode = !!(onMoveToProject || onChangePriority || onChangeDueDate)

  const toggleMenu = (menu: ActiveMenu) => {
    setActiveMenu((prev) => (prev === menu ? null : menu))
  }

  // Close menus when clicking outside the bar
  useEffect(() => {
    if (!activeMenu) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activeMenu])

  const label = selectedCount === 1 ? itemLabel : `${itemLabel}s`

  return (
    <div
      ref={barRef}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 shadow-2xl"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        minWidth: '360px',
        maxWidth: '620px',
      }}
    >
      {/* Select all checkbox + count */}
      <button
        onClick={allSelected ? onClearAll : onSelectAll}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover-bg-hover"
        title={allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
      >
        <div
          className="h-4 w-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            borderColor: allSelected ? 'var(--color-primary)' : 'var(--text-muted)',
            backgroundColor: allSelected ? 'var(--color-primary)' : 'transparent',
          }}
        >
          {allSelected && <Check size={10} color="white" />}
          {!allSelected && selectedCount > 0 && selectedCount < totalCount && (
            <div
              className="h-1.5 w-1.5 rounded-sm"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
          )}
        </div>
        <span
          className="whitespace-nowrap text-sm font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {selectedCount} {label}
        </span>
      </button>

      <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--border-primary)' }} />

      {/* Task-specific actions */}
      {isTaskMode && (
        <>
          {/* Move to project */}
          {onMoveToProject && (
            <div className="relative">
              <button
                onClick={() => toggleMenu('project')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                style={{
                  color:
                    activeMenu === 'project' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeMenu === 'project' ? 'var(--bg-secondary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeMenu !== 'project')
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (activeMenu !== 'project')
                    e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <FolderOpen size={14} />
                <span className="text-xs font-medium">Proyecto</span>
              </button>
              {activeMenu === 'project' && (
                <div
                  className="absolute bottom-full mb-2 left-0 z-[60] w-52 rounded-xl border py-1 shadow-xl max-h-60 overflow-y-auto"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  {regularProjects.length === 0 ? (
                    <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Sin proyectos
                    </p>
                  ) : (
                    flattenProjectTree(buildProjectTree(regularProjects)).map((project) => {
                      const pSections = sectionsMap?.get(project.id) ?? []
                      return (
                        <div key={project.id}>
                          <button
                            onClick={() => {
                              onMoveToProject(project.id, null)
                              setActiveMenu(null)
                            }}
                            className="flex w-full items-center gap-2.5 py-1.5 pr-3 text-sm transition-colors hover-bg-hover"
                            style={{
                              paddingLeft: 12 + project.depth * 12,
                              color: 'var(--text-primary)',
                            }}
                          >
                            <span
                              className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                              style={{ backgroundColor: project.color }}
                            />
                            <span className="truncate">{project.name}</span>
                          </button>
                          {pSections.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => {
                                onMoveToProject(project.id, s.id)
                                setActiveMenu(null)
                              }}
                              className="flex w-full items-center gap-2 py-1 pr-3 text-xs transition-colors hover-bg-hover"
                              style={{
                                paddingLeft: 28 + project.depth * 12,
                                color: 'var(--text-secondary)',
                              }}
                            >
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: project.color, opacity: 0.6 }}
                              />
                              <span className="truncate">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* Priority */}
          {onChangePriority && (
            <div className="relative">
              <button
                onClick={() => toggleMenu('priority')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                style={{
                  color:
                    activeMenu === 'priority' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  backgroundColor:
                    activeMenu === 'priority' ? 'var(--bg-secondary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeMenu !== 'priority')
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (activeMenu !== 'priority')
                    e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Flag size={14} />
                <span className="text-xs font-medium">Prioridad</span>
              </button>
              {activeMenu === 'priority' && (
                <div
                  className="absolute bottom-full mb-2 left-0 z-[60] w-44 rounded-xl border py-1 shadow-xl"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  {([1, 2, 3, 4] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        onChangePriority(p)
                        setActiveMenu(null)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover-bg-hover"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <Flag size={14} style={{ color: PRIORITY_COLORS[p] }} />P{p} ·{' '}
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Due date */}
          {onChangeDueDate && (
            <div className="relative">
              <button
                onClick={() => toggleMenu('date')}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                style={{
                  color: activeMenu === 'date' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeMenu === 'date' ? 'var(--bg-secondary)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (activeMenu !== 'date')
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (activeMenu !== 'date') e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Calendar size={14} />
                <span className="text-xs font-medium">Fecha</span>
              </button>
              {activeMenu === 'date' && (
                <div
                  className="absolute bottom-full mb-2 left-0 z-[60] w-56 rounded-xl border shadow-xl overflow-hidden"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <MiniDatePicker
                    onSelect={(date) => {
                      onChangeDueDate(date)
                      setActiveMenu(null)
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--border-primary)' }} />
        </>
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors"
        style={{ color: 'var(--color-accent)' }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor =
            'color-mix(in srgb, var(--color-accent) 8%, transparent)')
        }
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Trash2 size={14} />
        <span className="text-xs font-medium">Eliminar</span>
      </button>

      <div className="h-4 w-px mx-0.5" style={{ backgroundColor: 'var(--border-primary)' }} />

      {/* Exit */}
      <button
        onClick={onExit}
        className="rounded-lg p-1.5 transition-colors hover-bg-hover"
        style={{ color: 'var(--text-muted)' }}
        title="Cancelar selección"
      >
        <X size={15} />
      </button>
    </div>
  )
}
