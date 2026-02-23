import { useState, useRef, useEffect } from 'react'
import {
  List,
  LayoutGrid,
  CalendarDays,
  ChevronDown,
  Check,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore, defaultViewOptions } from '@/stores/uiStore'
import type { ViewOptions, ViewStyle, SortBy, GroupBy, CalendarMode } from '@/stores/uiStore'
import { useLabels } from '@/hooks/useLabels'

interface ViewOptionsBarProps {
  viewId: string
}

export function ViewOptionsBar({ viewId }: ViewOptionsBarProps) {
  const { getViewOptions, setViewOption } = useUIStore()
  const opts = getViewOptions(viewId)
  const { data: labels = [] } = useLabels()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const set = <K extends keyof ViewOptions>(key: K, value: ViewOptions[K]) =>
    setViewOption(viewId, key, value)

  const hasActiveFilters =
    opts.filterPriority !== null ||
    opts.filterLabelId !== null ||
    opts.filterDueDate !== 'all' ||
    !opts.showCompleted === defaultViewOptions.showCompleted

  const viewStyles: { style: ViewStyle; icon: typeof List; label: string }[] = [
    { style: 'list', icon: List, label: 'Lista' },
    { style: 'panel', icon: LayoutGrid, label: 'Panel' },
    { style: 'calendar', icon: CalendarDays, label: 'Calendario' },
  ]

  const calendarModes: { mode: CalendarMode; label: string }[] = [
    { mode: 'month', label: 'Mes' },
    { mode: 'week', label: 'Semana' },
    { mode: '4days', label: '4 días' },
    { mode: 'day', label: 'Día' },
  ]

  const sortOptions: { value: SortBy; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'due_date', label: 'Fecha límite' },
    { value: 'priority', label: 'Prioridad' },
    { value: 'name', label: 'Nombre' },
  ]

  const groupOptions: { value: GroupBy; label: string }[] = [
    { value: 'none', label: 'Ninguno' },
    { value: 'priority', label: 'Prioridad' },
    { value: 'label', label: 'Etiqueta' },
  ]

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border p-1.5"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}
    >
      {/* View style toggles */}
      <div className="flex items-center rounded-lg overflow-hidden">
        {viewStyles.map(({ style, icon: Icon, label }) => (
          <button
            key={style}
            onClick={() => set('viewStyle', style)}
            title={label}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors rounded-lg',
              opts.viewStyle === style
                ? 'text-white'
                : 'hover:opacity-80',
            )}
            style={{
              backgroundColor: opts.viewStyle === style ? '#283B56' : 'transparent',
              color: opts.viewStyle === style ? '#fff' : 'var(--text-secondary)',
            }}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Calendar mode sub-selector */}
      {opts.viewStyle === 'calendar' && (
        <>
          <div className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />
          <div className="flex items-center rounded-lg overflow-hidden">
            {calendarModes.map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => set('calendarMode', mode)}
                className="px-2.5 py-1.5 text-xs font-medium transition-colors rounded-lg"
                style={{
                  backgroundColor: opts.calendarMode === mode ? '#EC1E2A' : 'transparent',
                  color: opts.calendarMode === mode ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--border-primary)' }} />

      {/* Completed toggle */}
      <button
        onClick={() => set('showCompleted', !opts.showCompleted)}
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        )}
        style={{
          backgroundColor: opts.showCompleted ? '#283B5618' : 'transparent',
          color: opts.showCompleted ? '#283B56' : 'var(--text-secondary)',
        }}
      >
        <Check size={13} />
        <span className="hidden sm:inline">Completadas</span>
      </button>

      <div className="flex-1" />

      {/* Sort by */}
      <DropdownMenu
        label={sortOptions.find((o) => o.value === opts.sortBy)?.label ?? 'Ordenar'}
        prefix="Ordenar:"
      >
        {sortOptions.map((o) => (
          <DropdownItem
            key={o.value}
            label={o.label}
            active={opts.sortBy === o.value}
            onClick={() => set('sortBy', o.value)}
          />
        ))}
      </DropdownMenu>

      {/* Group by */}
      <DropdownMenu
        label={groupOptions.find((o) => o.value === opts.groupBy)?.label ?? 'Agrupar'}
        prefix="Agrupar:"
      >
        {groupOptions.map((o) => (
          <DropdownItem
            key={o.value}
            label={o.label}
            active={opts.groupBy === o.value}
            onClick={() => set('groupBy', o.value)}
          />
        ))}
      </DropdownMenu>

      {/* Filters */}
      <div className="relative" ref={filtersRef}>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            backgroundColor: hasActiveFilters ? '#EC1E2A18' : 'transparent',
            color: hasActiveFilters ? '#EC1E2A' : 'var(--text-secondary)',
          }}
        >
          <SlidersHorizontal size={13} />
          <span className="hidden sm:inline">Filtros</span>
          {hasActiveFilters && <span className="rounded-full bg-red-500 w-1.5 h-1.5" />}
          <ChevronDown size={12} />
        </button>

        {filtersOpen && (
          <div
            className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border p-3 shadow-xl space-y-3"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            {/* Priority filter */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Prioridad
              </p>
              <div className="flex flex-wrap gap-1">
                {[null, 1, 2, 3, 4].map((p) => {
                  const colors: Record<number, string> = { 1: '#EC1E2A', 2: '#F59E0B', 3: '#3B82F6', 4: '#6B7280' }
                  const labels: Record<number, string> = { 1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4' }
                  const isActive = opts.filterPriority === p
                  return (
                    <button
                      key={String(p)}
                      onClick={() => set('filterPriority', p)}
                      className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors border"
                      style={{
                        borderColor: p === null ? 'var(--border-primary)' : colors[p],
                        backgroundColor: isActive ? (p === null ? '#283B56' : colors[p]) : 'transparent',
                        color: isActive ? '#fff' : p === null ? 'var(--text-primary)' : colors[p],
                      }}
                    >
                      {p === null ? 'Todas' : labels[p]}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Label filter */}
            {labels.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Etiqueta
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => set('filterLabelId', null)}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      borderColor: 'var(--border-primary)',
                      backgroundColor: opts.filterLabelId === null ? '#283B56' : 'transparent',
                      color: opts.filterLabelId === null ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    Todas
                  </button>
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => set('filterLabelId', label.id)}
                      className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        borderColor: label.color,
                        backgroundColor: opts.filterLabelId === label.id ? label.color : 'transparent',
                        color: opts.filterLabelId === label.id ? '#fff' : label.color,
                      }}
                    >
                      {label.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Due date filter */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Fecha límite
              </p>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: 'all', label: 'Todas' },
                  { value: 'today', label: 'Hoy' },
                  { value: 'week', label: 'Esta semana' },
                  { value: 'overdue', label: 'Vencidas' },
                  { value: 'nodate', label: 'Sin fecha' },
                ].map((o) => (
                  <button
                    key={o.value}
                    onClick={() => set('filterDueDate', o.value as ViewOptions['filterDueDate'])}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    style={{
                      borderColor: 'var(--border-primary)',
                      backgroundColor: opts.filterDueDate === o.value ? '#283B56' : 'transparent',
                      color: opts.filterDueDate === o.value ? '#fff' : 'var(--text-primary)',
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                set('filterPriority', null)
                set('filterLabelId', null)
                set('filterDueDate', 'all')
              }}
              className="w-full rounded-lg py-1.5 text-xs font-medium transition-colors"
              style={{ color: '#EC1E2A' }}
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Helpers ─────────────────────────────────────────── */

function DropdownMenu({
  label,
  prefix,
  children,
}: {
  label: string
  prefix: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>{prefix}</span>
        <span style={{ color: 'var(--text-primary)' }}>{label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border py-1 shadow-xl"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownItem({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors"
      style={{ color: 'var(--text-primary)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {label}
      {active && <Check size={13} style={{ color: '#283B56' }} />}
    </button>
  )
}
