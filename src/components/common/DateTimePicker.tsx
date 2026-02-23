import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
  getDay,
  startOfWeek,
  endOfWeek,
  parseISO,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar, Clock, ChevronLeft, ChevronRight, X, Timer } from 'lucide-react'

interface DateTimePickerProps {
  date: string | null
  time: string | null
  hasTime: boolean
  durationMinutes: number | null
  onDateChange: (date: string | null) => void
  onTimeChange: (time: string | null) => void
  onHasTimeChange: (hasTime: boolean) => void
  onDurationChange: (minutes: number | null) => void
}

const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

export function DateTimePicker({
  date,
  time,
  hasTime,
  durationMinutes,
  onDateChange,
  onTimeChange,
  onHasTimeChange,
  onDurationChange,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => (date ? parseISO(date) : new Date()))
  const containerRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(() => (date ? parseISO(date) : null), [date])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const handleDayClick = useCallback(
    (day: Date) => {
      onDateChange(format(day, 'yyyy-MM-dd'))
      if (!isSameMonth(day, viewMonth)) setViewMonth(day)
    },
    [onDateChange, viewMonth],
  )

  const handleClear = useCallback(() => {
    onDateChange(null)
    onTimeChange(null)
    onHasTimeChange(false)
    onDurationChange(null)
    setOpen(false)
  }, [onDateChange, onTimeChange, onHasTimeChange, onDurationChange])

  const handleShortcut = useCallback(
    (daysFromToday: number) => {
      const target = addDays(today, daysFromToday)
      onDateChange(format(target, 'yyyy-MM-dd'))
      setViewMonth(target)
    },
    [today, onDateChange],
  )

  const handleNextWeek = useCallback(() => {
    const dayOfWeek = getDay(today)
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const nextMonday = addDays(today, daysUntilMonday)
    onDateChange(format(nextMonday, 'yyyy-MM-dd'))
    setViewMonth(nextMonday)
  }, [today, onDateChange])

  const handleHasTimeToggle = useCallback(() => {
    const next = !hasTime
    onHasTimeChange(next)
    if (next && !time) onTimeChange('09:00')
    if (!next) onTimeChange(null)
  }, [hasTime, time, onHasTimeChange, onTimeChange])

  const triggerLabel = useMemo(() => {
    if (!selectedDate) return null
    const dateStr = format(selectedDate, "d 'de' MMMM", { locale: es })
    if (hasTime && time) return `${dateStr}, ${time}`
    return dateStr
  }, [selectedDate, hasTime, time])

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
        style={{ color: selectedDate ? 'var(--text-primary)' : 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Calendar size={14} />
        <span>{triggerLabel ?? 'Agregar fecha'}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl p-3 shadow-xl"
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded p-1 transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronLeft size={16} style={{ color: 'var(--text-primary)' }} />
            </button>
            <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
              {format(viewMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded p-1 transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronRight size={16} style={{ color: 'var(--text-primary)' }} />
            </button>
          </div>

          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_HEADERS.map((d) => (
              <span key={d} className="py-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {d}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {calendarDays.map((day) => {
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const isToday = isSameDay(day, today)
              const isCurrentMonth = isSameMonth(day, viewMonth)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className="relative flex flex-col items-center justify-center rounded-md py-1 text-xs transition-colors"
                  style={{
                    backgroundColor: isSelected ? '#283B56' : undefined,
                    color: isSelected ? '#fff' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: isSelected ? 700 : undefined,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = ''
                  }}
                >
                  {format(day, 'd')}
                  {isToday && (
                    <span
                      className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                      style={{ backgroundColor: isSelected ? '#fff' : '#EC1E2A' }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          <div className="my-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* Shortcuts */}
          <div className="mb-3 flex gap-1.5">
            {[
              { label: 'Hoy', action: () => handleShortcut(0) },
              { label: 'Mañana', action: () => handleShortcut(1) },
              { label: 'Próx. semana', action: handleNextWeek },
            ].map(({ label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="flex-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors"
                style={{
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-primary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Time toggle */}
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Clock size={13} />
              Con hora
            </span>
            <button
              type="button"
              onClick={handleHasTimeToggle}
              className="relative h-5 w-9 rounded-full transition-colors duration-200"
              style={{ backgroundColor: hasTime ? '#283B56' : 'var(--bg-hover)' }}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200"
                style={{ left: hasTime ? '18px' : '2px' }}
              />
            </button>
          </div>

          {hasTime && (
            <div className="mb-2 flex items-center gap-2">
              <input
                type="time"
                value={time ?? '09:00'}
                onChange={(e) => onTimeChange(e.target.value || null)}
                className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          {/* Duration */}
          <div className="mb-3 flex items-center gap-2">
            <Timer size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="number"
              min={1}
              placeholder="Duración (min)"
              value={durationMinutes ?? ''}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                onDurationChange(isNaN(val) ? null : val)
              }}
              className="w-full rounded-lg border px-2 py-1.5 text-xs outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Clear */}
          {selectedDate && (
            <button
              type="button"
              onClick={handleClear}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors"
              style={{ color: '#EC1E2A' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EC1E2A11')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={13} />
              Limpiar fecha
            </button>
          )}
        </div>
      )}
    </div>
  )
}
