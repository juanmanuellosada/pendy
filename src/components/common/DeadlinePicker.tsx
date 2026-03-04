import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
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
  isToday as isDateToday,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, AlarmClock, RefreshCw, CalendarDays } from 'lucide-react'
import { parseLocalDate, formatRelativeDate } from '@/lib/utils'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'

const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

interface DeadlinePickerProps {
  deadline: string | null
  onDeadlineChange: (deadline: string | null) => void
  shortcutKey?: string
  inline?: boolean
}

export function DeadlinePicker({
  deadline,
  onDeadlineChange,
  shortcutKey,
  inline = false,
}: DeadlinePickerProps) {
  const [open, setOpen] = useState(inline)
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    deadline ? parseLocalDate(deadline) : new Date(),
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const floatingStyle = useFloatingPosition(containerRef, open && !inline, 288) // w-72 = 288px
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(() => (deadline ? parseLocalDate(deadline) : null), [deadline])

  useEffect(() => {
    if (!open || inline) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, inline])

  useEffect(() => {
    if (deadline) setViewMonth(parseLocalDate(deadline))
  }, [deadline])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const handleDayClick = useCallback(
    (day: Date) => {
      onDeadlineChange(format(day, 'yyyy-MM-dd'))
      if (!isSameMonth(day, viewMonth)) setViewMonth(day)
      if (!inline) setOpen(false)
    },
    [onDeadlineChange, viewMonth, inline],
  )

  const handleClear = useCallback(() => {
    onDeadlineChange(null)
    if (!inline) setOpen(false)
  }, [onDeadlineChange, inline])

  // Quick shortcuts relative to today
  const shortcuts = useMemo(() => {
    const d3 = addDays(today, 3)
    const w1 = addDays(today, 7)
    const m1 = addMonths(today, 1)
    return [
      {
        label: '3 días después de ...',
        hint: format(d3, 'd MMM', { locale: es }),
        date: d3,
      },
      {
        label: '1 semana después ...',
        hint: format(w1, 'd MMM', { locale: es }),
        date: w1,
      },
      {
        label: '1 mes después de l...',
        hint: format(m1, 'd MMM', { locale: es }),
        date: m1,
      },
    ]
  }, [today])

  const triggerLabel = useMemo(() => {
    if (!deadline) return null
    return formatRelativeDate(deadline)
  }, [deadline])

  return (
    <div className={inline ? '' : 'relative'} ref={containerRef}>
      {!inline && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          style={{
            backgroundColor: deadline ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
            borderColor: deadline ? 'rgba(59,130,246,0.3)' : 'var(--border-primary)',
            color: deadline ? 'var(--color-link)' : 'var(--text-primary)',
          }}
        >
          <AlarmClock size={14} />
          {triggerLabel ?? 'Fecha límite'}
          {deadline && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10"
            >
              <X size={10} />
            </button>
          )}
          {shortcutKey && (
            <span
              className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
              style={{
                backgroundColor: deadline ? 'rgba(59,130,246,0.15)' : 'var(--bg-primary)',
                color: 'var(--text-muted)',
              }}
            >
              {shortcutKey}
            </span>
          )}
        </button>
      )}

      {(inline || open) && (
        <div
          className={inline ? 'w-72 overflow-hidden' : 'w-72 rounded-xl border shadow-xl'}
          style={{
            ...(inline ? {} : floatingStyle),
            backgroundColor: 'var(--bg-primary)',
            ...(inline
              ? {}
              : { borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }),
          }}
        >
          {/* NLP input */}
          <div className="border-b p-3" style={{ borderColor: 'var(--border-secondary)' }}>
            <div className="flex items-center gap-2">
              <RefreshCw size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Escribe una fecha límite"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Simple date parsing for common inputs
                    const val = (e.target as HTMLInputElement).value.trim().toLowerCase()
                    if (val === 'hoy') {
                      onDeadlineChange(format(today, 'yyyy-MM-dd'))
                      if (!inline) setOpen(false)
                    } else if (val === 'mañana' || val === 'manana') {
                      onDeadlineChange(format(addDays(today, 1), 'yyyy-MM-dd'))
                      if (!inline) setOpen(false)
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Quick shortcuts */}
          <div className="border-b py-1" style={{ borderColor: 'var(--border-secondary)' }}>
            {shortcuts.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  onDeadlineChange(format(s.date, 'yyyy-MM-dd'))
                  if (!inline) setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover-bg-hover"
                style={{ color: 'var(--text-primary)' }}
              >
                <CalendarDays size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="flex-1 text-left">{s.label}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {s.hint}
                </span>
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div className="p-3">
            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between">
              <span
                className="text-sm font-semibold capitalize"
                style={{ color: 'var(--text-primary)' }}
              >
                {format(viewMonth, 'MMM yyyy', { locale: es })}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
                  className="rounded p-1 transition-colors hover-bg-hover"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setViewMonth(new Date())}
                  className="rounded px-1.5 py-0.5 text-xs transition-colors hover-bg-hover"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ○
                </button>
                <button
                  onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
                  className="rounded p-1 transition-colors hover-bg-hover"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="mb-1 grid grid-cols-7 gap-0">
              {DAY_HEADERS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-0">
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, viewMonth)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isToday = isDateToday(day)
                return (
                  <button
                    key={i}
                    onClick={() => handleDayClick(day)}
                    className="flex h-9 w-full items-center justify-center rounded-md text-xs transition-colors"
                    style={{
                      backgroundColor: isSelected
                        ? 'var(--color-link)'
                        : isToday
                          ? 'var(--bg-hover)'
                          : 'transparent',
                      color: isSelected
                        ? '#fff'
                        : !inMonth
                          ? 'var(--text-muted)'
                          : isToday
                            ? 'var(--color-link)'
                            : 'var(--text-primary)',
                      fontWeight: isToday || isSelected ? 700 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.backgroundColor = isToday
                          ? 'var(--bg-hover)'
                          : 'transparent'
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
