import { useState, useRef, useEffect, useMemo } from 'react'
import {
  List,
  LayoutGrid,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, defaultViewOptions } from '@/stores/uiStore'
import type {
  ViewOptions,
  ViewStyle,
  SortBy,
  GroupBy,
  CalendarMode,
  FilterDueDate,
} from '@/stores/uiStore'
import { useLabels } from '@/hooks/useLabels'

interface ViewOptionsBarProps {
  viewId: string
  /** Which view styles to show. Defaults to all three. */
  availableStyles?: ViewStyle[]
  /** Hide the date filter (e.g. in Today view). */
  hideDateFilter?: boolean
  /** Show the "upcoming days" selector (only for Upcoming view, list/panel only). */
  showUpcomingDays?: boolean
  /** Hide the calendar mode picker (week/month/4days/day) — e.g. Today only shows day. */
  hideCalendarMode?: boolean
  /** Which calendar modes to show. Defaults to all. */
  availableCalendarModes?: CalendarMode[]
  /** Show the habits toggle (only for views that display habits). */
  showHabitsToggle?: boolean
}

const viewStyles: { style: ViewStyle; icon: typeof List; label: string }[] = [
  { style: 'list', icon: List, label: 'Lista' },
  { style: 'panel', icon: LayoutGrid, label: 'Panel' },
  { style: 'calendar', icon: CalendarDays, label: 'Calendario' },
]

const calendarModes: { mode: CalendarMode; label: string }[] = [
  { mode: 'week', label: 'Semana' },
  { mode: 'month', label: 'Mes' },
  { mode: '4days', label: '4 días' },
  { mode: 'day', label: 'Día' },
]

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'name', label: 'Nombre' },
  { value: 'due_date', label: 'Fecha' },
  { value: 'priority', label: 'Prioridad' },
]

const groupOptions: { value: GroupBy; label: string }[] = [
  { value: 'none', label: 'Ninguno' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'label', label: 'Etiqueta' },
]

const dueDateOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'today', label: 'Hoy' },
  { value: 'week', label: 'Esta semana' },
  { value: 'overdue', label: 'Vencidas' },
  { value: 'nodate', label: 'Sin fecha' },
]

const priorityOptions: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: '1', label: 'P1 - Urgente' },
  { value: '2', label: 'P2 - Alta' },
  { value: '3', label: 'P3 - Media' },
  { value: '4', label: 'P4 - Baja' },
]

const upcomingDaysOptions: { value: string; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
  { value: '60', label: '60 días' },
  { value: '90', label: '90 días' },
]

export function ViewOptionsBar({
  viewId,
  availableStyles,
  hideDateFilter,
  showUpcomingDays,
  hideCalendarMode,
  availableCalendarModes,
  showHabitsToggle,
}: ViewOptionsBarProps) {
  const { getViewOptions, setViewOption } = useUIStore()
  const opts = getViewOptions(viewId)
  const { data: labels = [] } = useLabels()
  const [open, setOpen] = useState(false)
  const [ordenOpen, setOrdenOpen] = useState(true)
  const [filtroOpen, setFiltroOpen] = useState(true)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const set = <K extends keyof ViewOptions>(key: K, value: ViewOptions[K]) =>
    setViewOption(viewId, key, value)

  const activeCount = useMemo(() => {
    let count = 0
    if (opts.viewStyle !== defaultViewOptions.viewStyle) count++
    if (opts.showCompleted !== defaultViewOptions.showCompleted) count++
    if (showHabitsToggle && opts.showHabits !== defaultViewOptions.showHabits) count++
    if (opts.sortBy !== defaultViewOptions.sortBy) count++
    if (opts.groupBy !== defaultViewOptions.groupBy) count++
    if (opts.filterPriority !== null) count++
    if (opts.filterLabelId !== null) count++
    if (opts.filterDueDate !== 'all') count++
    if (showUpcomingDays && (opts.upcomingDays ?? 30) !== defaultViewOptions.upcomingDays) count++
    return count
  }, [opts, showUpcomingDays, showHabitsToggle])

  const resetAll = () => {
    set('viewStyle', defaultViewOptions.viewStyle)
    set('showCompleted', defaultViewOptions.showCompleted)
    set('showHabits', defaultViewOptions.showHabits)
    set('sortBy', defaultViewOptions.sortBy)
    set('groupBy', defaultViewOptions.groupBy)
    set('filterPriority', null)
    set('filterLabelId', null)
    set('filterDueDate', 'all')
    set('calendarMode', defaultViewOptions.calendarMode)
    set('upcomingDays', defaultViewOptions.upcomingDays)
  }

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          open && 'ring-1',
        )}
        style={{
          backgroundColor: activeCount > 0 ? '#283B5612' : 'transparent',
          color: activeCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
        }}
        onMouseLeave={(e) => {
          if (!open && activeCount === 0) e.currentTarget.style.backgroundColor = 'transparent'
          else if (!open && activeCount > 0)
            e.currentTarget.style.backgroundColor = '#283B5612'
        }}
      >
        <SlidersHorizontal size={15} />
        <span>
          Formato{activeCount > 0 ? `: ${activeCount}` : ''}
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-2xl border shadow-2xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* ── Vista section ────────────────────── */}
          <div className="p-4 pb-3 space-y-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Vista
                </span>
                {activeCount > 0 && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: '#EC1E2A' }}
                  />
                )}
              </div>
              <div
                className="flex rounded-xl p-1 gap-1"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {viewStyles
                  .filter((v) => !availableStyles || availableStyles.includes(v.style))
                  .map(({ style, icon: Icon, label }) => (
                  <button
                    key={style}
                    onClick={() => set('viewStyle', style)}
                    className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2.5 text-xs font-medium transition-all"
                    style={{
                      backgroundColor:
                        opts.viewStyle === style ? 'var(--bg-primary)' : 'transparent',
                      color:
                        opts.viewStyle === style
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                      boxShadow:
                        opts.viewStyle === style
                          ? '0 1px 3px rgba(0,0,0,0.12)'
                          : 'none',
                    }}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Calendar mode */}
            {opts.viewStyle === 'calendar' && !hideCalendarMode && (
              <div className="flex items-center justify-between">
                <span
                  className="text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Formato
                </span>
                <div
                  className="flex rounded-lg overflow-hidden p-0.5 gap-0.5"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  {calendarModes
                    .filter((m) => !availableCalendarModes || availableCalendarModes.includes(m.mode))
                    .map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => set('calendarMode', mode)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor:
                          opts.calendarMode === mode ? '#283B56' : 'transparent',
                        color:
                          opts.calendarMode === mode ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Completados */}
            <div className="flex items-center justify-between" title="Mostrar tareas y hábitos completados">
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Completados
              </span>
              <ToggleSwitch
                checked={opts.showCompleted}
                onChange={(v) => set('showCompleted', v)}
              />
            </div>

            {/* Hábitos */}
            {showHabitsToggle && (
              <div className="flex items-center justify-between" title="Mostrar hábitos del día">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Hábitos
                </span>
                <ToggleSwitch
                  checked={opts.showHabits ?? true}
                  onChange={(v) => set('showHabits', v)}
                />
              </div>
            )}

            {/* Futuras recurrencias (solo en calendario) */}
            {opts.viewStyle === 'calendar' && (
              <div className="flex items-center justify-between" title="Mostrar futuras recurrencias de tareas periódicas">
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Futuras recurrencias
                </span>
                <ToggleSwitch
                  checked={opts.showFutureRecurrences}
                  onChange={(v) => set('showFutureRecurrences', v)}
                />
              </div>
            )}

            {/* Upcoming days selector (only in list/panel, not calendar) */}
            {showUpcomingDays && opts.viewStyle !== 'calendar' && (
              <SelectRow
                label="Días próximos"
                value={String(opts.upcomingDays ?? 30)}
                displayValue={`${opts.upcomingDays ?? 30} días`}
                options={upcomingDaysOptions.map((o) => ({
                  value: o.value,
                  label: o.label,
                  active: String(opts.upcomingDays ?? 30) === o.value,
                }))}
                onChange={(v) => set('upcomingDays', Number(v))}
              />
            )}
          </div>

          {opts.viewStyle !== 'calendar' && (
            <>
              <Divider />

              {/* ── Orden section ────────────────────── */}
              <CollapsibleSection
                title="Orden"
                open={ordenOpen}
                onToggle={() => setOrdenOpen(!ordenOpen)}
              >
                <div className="space-y-3 px-4 pb-4">
                  <SelectRow
                    label="Ordenar por"
                    value={opts.sortBy}
                    displayValue={
                      sortOptions.find((o) => o.value === opts.sortBy)?.label ?? 'Manual'
                    }
                    options={sortOptions.map((o) => ({
                      value: o.value,
                      label: o.label,
                      active: opts.sortBy === o.value,
                    }))}
                    onChange={(v) => set('sortBy', v as SortBy)}
                  />
                  <SelectRow
                    label="Agrupar por"
                    value={opts.groupBy}
                    displayValue={
                      groupOptions.find((o) => o.value === opts.groupBy)?.label ?? 'Ninguno'
                    }
                    options={groupOptions.map((o) => ({
                      value: o.value,
                      label: o.label,
                      active: opts.groupBy === o.value,
                    }))}
                    onChange={(v) => set('groupBy', v as GroupBy)}
                  />
                </div>
              </CollapsibleSection>
            </>
          )}

          <Divider />

          {/* ── Filtro section ────────────────────── */}
          <CollapsibleSection
            title="Filtro"
            open={filtroOpen}
            onToggle={() => setFiltroOpen(!filtroOpen)}
          >
            <div className="space-y-3 px-4 pb-4">
              {!hideDateFilter && (
                <SelectRow
                  label="Fecha límite"
                  value={opts.filterDueDate}
                  displayValue={
                    dueDateOptions.find((o) => o.value === opts.filterDueDate)?.label ??
                    'Todas'
                  }
                  options={dueDateOptions.map((o) => ({
                    value: o.value,
                    label: o.label,
                    active: opts.filterDueDate === o.value,
                  }))}
                  onChange={(v) => set('filterDueDate', v as FilterDueDate)}
                />
              )}
              <SelectRow
                label="Prioridad"
                value={opts.filterPriority === null ? 'all' : String(opts.filterPriority)}
                displayValue={
                  opts.filterPriority === null
                    ? 'Todas'
                    : `P${opts.filterPriority}`
                }
                options={priorityOptions.map((o) => ({
                  value: o.value,
                  label: o.label,
                  active:
                    (o.value === 'all' && opts.filterPriority === null) ||
                    String(opts.filterPriority) === o.value,
                }))}
                onChange={(v) =>
                  set('filterPriority', v === 'all' ? null : Number(v))
                }
              />
              <SelectRow
                label="Etiqueta"
                value={opts.filterLabelId ?? 'all'}
                displayValue={
                  opts.filterLabelId === null
                    ? 'Todas'
                    : (labels.find((l) => l.id === opts.filterLabelId)?.name ?? 'Todas')
                }
                options={[
                  { value: 'all', label: 'Todas', active: opts.filterLabelId === null },
                  ...labels.map((l) => ({
                    value: l.id,
                    label: l.name,
                    active: opts.filterLabelId === l.id,
                  })),
                ]}
                onChange={(v) => set('filterLabelId', v === 'all' ? null : v)}
              />
              <button
                onClick={resetAll}
                className="w-full pt-1 text-center text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: '#EC1E2A' }}
              >
                Restablecer todo
              </button>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ───────────────────────────────────── */

function Divider() {
  return (
    <div
      className="mx-4 border-t"
      style={{ borderColor: 'var(--border-primary)' }}
    />
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200"
      style={{
        backgroundColor: checked ? '#EC1E2A' : 'var(--bg-tertiary, #6B728050)',
      }}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{
          transform: checked ? 'translate(17px, 2px)' : 'translate(2px, 2px)',
        }}
      />
    </button>
  )
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold transition-colors"
        style={{ color: 'var(--text-primary)' }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = 'transparent')
        }
      >
        {title}
        {open ? (
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>
      {open && children}
    </div>
  )
}

function SelectRow({
  label,
  displayValue,
  options,
  onChange,
}: {
  label: string
  value: string
  displayValue: string
  options: { value: string; label: string; active: boolean }[]
  onChange: (value: string) => void
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  return (
    <div className="flex items-center justify-between" ref={ref}>
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')
          }
        >
          {displayValue}
          <ChevronDown size={13} style={{ color: 'var(--text-muted)' }} />
        </button>

        {dropdownOpen && (
          <div
            className="absolute right-0 top-full z-[60] mt-1 min-w-[160px] rounded-xl border py-1 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setDropdownOpen(false)
                }}
                className="flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                {opt.label}
                {opt.active && (
                  <span style={{ color: '#283B56' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
