import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  format,
  subMinutes,
  subHours,
  subDays,
  subWeeks,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addDays,
  nextSaturday,
  getDay,
  isToday as isDateToday,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { X, ChevronDown, ChevronLeft, ChevronRight, Clock, Bell, Info, HelpCircle, Sun, Sofa, ArrowRight, Circle } from 'lucide-react'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'

export interface ReminderConfig {
  type: 'datetime' | 'before'
  /** For 'datetime': ISO string. For 'before': minutes before due datetime. */
  value: string | number
  label: string
}

const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']
const DAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']

const BEFORE_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'A la hora de la tarea', minutes: 0 },
  { label: '10 mins antes', minutes: 10 },
  { label: '30 mins antes', minutes: 30 },
  { label: '45 mins antes', minutes: 45 },
  { label: '1 hora antes', minutes: 60 },
  { label: '2 horas antes', minutes: 120 },
  { label: '3 horas antes', minutes: 180 },
  { label: '1 día antes', minutes: 1440 },
  { label: '2 días antes', minutes: 2880 },
  { label: '3 días antes', minutes: 4320 },
  { label: '1 semana antes', minutes: 10080 },
]

interface ReminderPickerProps {
  reminders: ReminderConfig[]
  onAdd: (reminder: ReminderConfig) => void
  onRemove: (index: number) => void
  hasDateTime: boolean // whether the task has a due date + time
  dueDate: string | null
  dueTime: string | null
  shortcutKey?: string
  inline?: boolean
}

export function ReminderPicker({
  reminders,
  onAdd,
  onRemove,
  hasDateTime,
  dueDate: _dueDate,
  dueTime: _dueTime,
  shortcutKey,
  inline = false,
}: ReminderPickerProps) {
  const [open, setOpen] = useState(inline)
  const [activeTab, setActiveTab] = useState<'datetime' | 'before'>('before')
  // Date state
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date())
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date())
  // Time state: separate hour/minute
  const [selectedHour, setSelectedHour] = useState('09')
  const [selectedMinute, setSelectedMinute] = useState('00')
  const [beforeDropdownOpen, setBeforeDropdownOpen] = useState(false)
  const [selectedBeforeMinutes, setSelectedBeforeMinutes] = useState(30)
  const containerRef = useRef<HTMLDivElement>(null)
  const floatingStyle = useFloatingPosition(containerRef, open && !inline, 340) // w-[340px]

  const today = useMemo(() => new Date(), [])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const dateShortcuts = useMemo(() => {
    const tomorrow = addDays(today, 1)
    const weekend = nextSaturday(today)
    return [
      { icon: Sun, color: '#22C55E', label: 'Hoy', hint: DAY_SHORT[getDay(today)], date: today },
      { icon: ArrowRight, color: '#F59E0B', label: 'Mañana', hint: DAY_SHORT[getDay(tomorrow)], date: tomorrow },
      { icon: Sofa, color: '#3B82F6', label: 'Fin de semana', hint: format(weekend, 'd MMM'), date: weekend },
      { icon: Circle, color: 'var(--text-muted)', label: 'Hoy', hint: '', date: today },
    ]
  }, [today])

  const handleDayClick = useCallback((day: Date) => {
    setSelectedDate(day)
    if (!isSameMonth(day, viewMonth)) setViewMonth(day)
  }, [viewMonth])

  useEffect(() => {
    if (!open || inline) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setBeforeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, inline])

  const selectedBeforeLabel = useMemo(
    () => BEFORE_OPTIONS.find((o) => o.minutes === selectedBeforeMinutes)?.label ?? '30 mins antes',
    [selectedBeforeMinutes],
  )

  const handleAddDatetime = () => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const timeStr = `${selectedHour}:${selectedMinute}`
    const datetime = `${dateStr}T${timeStr}:00`
    const label = `${format(selectedDate, 'd MMM', { locale: es })} ${timeStr}`
    onAdd({
      type: 'datetime',
      value: datetime,
      label,
    })
    if (!inline) setOpen(false)
  }

  const handleAddBefore = () => {
    const option = BEFORE_OPTIONS.find((o) => o.minutes === selectedBeforeMinutes)
    if (!option) return
    onAdd({
      type: 'before',
      value: option.minutes,
      label: option.label,
    })
    if (!inline) setOpen(false)
  }

  return (
    <div className={inline ? '' : 'relative'} ref={containerRef}>
      {!inline && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          style={{
            backgroundColor: reminders.length > 0 ? 'rgba(59,130,246,0.1)' : 'var(--bg-secondary)',
            borderColor: reminders.length > 0 ? 'rgba(59,130,246,0.3)' : 'var(--border-primary)',
            color: reminders.length > 0 ? '#3B82F6' : 'var(--text-primary)',
          }}
        >
          <Bell size={14} />
          Recordatorios
          {reminders.length > 0 && (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: '#3B82F6' }}
            >
              {reminders.length}
            </span>
          )}
          {shortcutKey && (
            <span
              className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
              style={{ backgroundColor: reminders.length > 0 ? 'rgba(59,130,246,0.15)' : 'var(--bg-primary)', color: 'var(--text-muted)' }}
            >
              {shortcutKey}
            </span>
          )}
        </button>
      )}

      {(inline || open) && (
        <div
          className={inline ? 'w-[340px] overflow-hidden' : 'w-[340px] rounded-xl border shadow-xl'}
          style={{
            ...(inline ? {} : floatingStyle),
            backgroundColor: 'var(--bg-primary)',
            ...(inline ? {} : { borderColor: 'var(--border-primary)', boxShadow: 'var(--shadow-lg)' }),
          }}
        >
          {/* Header */}
          <div className="border-b px-4 pt-3 pb-0" style={{ borderColor: 'var(--border-secondary)' }}>
            <h3
              className="mb-3 text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Recordatorios
            </h3>

            {/* Tabs */}
            <div className="flex">
              <button
                onClick={() => setActiveTab('datetime')}
                className="flex-1 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    activeTab === 'datetime' ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  color:
                    activeTab === 'datetime' ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom:
                    activeTab === 'datetime'
                      ? '2px solid var(--text-primary)'
                      : '2px solid transparent',
                }}
              >
                Fecha y hora
              </button>
              <button
                onClick={() => setActiveTab('before')}
                className="flex-1 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    activeTab === 'before' ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                  color:
                    activeTab === 'before' ? 'var(--text-primary)' : 'var(--text-muted)',
                  borderBottom:
                    activeTab === 'before'
                      ? '2px solid var(--text-primary)'
                      : '2px solid transparent',
                }}
              >
                Antes de la tarea
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            {activeTab === 'datetime' && (
              <div>
                {/* Quick date shortcuts */}
                <div className="mb-2 flex gap-1">
                  {dateShortcuts.slice(0, 3).map(({ icon: Icon, color, label, hint, date }) => (
                    <button
                      key={label + hint}
                      onClick={() => { setSelectedDate(date); setViewMonth(date) }}
                      title={label}
                      className="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors"
                      style={{
                        backgroundColor: isSameDay(selectedDate, date) ? color + '22' : 'var(--bg-secondary)',
                        border: `1px solid ${isSameDay(selectedDate, date) ? color + '55' : 'var(--border-primary)'}`,
                        color: isSameDay(selectedDate, date) ? color : 'var(--text-secondary)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = color + '18')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSameDay(selectedDate, date) ? color + '22' : 'var(--bg-secondary)')}
                    >
                      <Icon size={13} style={{ color }} />
                      <span style={{ fontSize: 9 }}>{hint || label}</span>
                    </button>
                  ))}
                </div>

                {/* Mini calendar */}
                <div
                  className="mb-3 rounded-lg border overflow-hidden"
                  style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
                >
                  {/* Month nav */}
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <button
                      onClick={() => setViewMonth((m) => subMonths(m, 1))}
                      className="rounded p-0.5 transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <ChevronLeft size={14} style={{ color: 'var(--text-primary)' }} />
                    </button>
                    <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                      {format(viewMonth, 'MMMM yyyy', { locale: es })}
                    </span>
                    <button
                      onClick={() => setViewMonth((m) => addMonths(m, 1))}
                      className="rounded p-0.5 transition-colors"
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <ChevronRight size={14} style={{ color: 'var(--text-primary)' }} />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 px-1 pb-0.5">
                    {DAY_HEADERS.map((d) => (
                      <span key={d} className="py-0.5 text-center text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div className="grid grid-cols-7 gap-y-0.5 px-1 pb-1.5 text-center">
                    {calendarDays.map((day) => {
                      const isSelected = isSameDay(day, selectedDate)
                      const isCurrent = isDateToday(day)
                      const inMonth = isSameMonth(day, viewMonth)
                      return (
                        <button
                          key={day.toISOString()}
                          onClick={() => handleDayClick(day)}
                          className="relative flex flex-col items-center justify-center rounded-md py-0.5 text-[11px] transition-colors"
                          style={{
                            backgroundColor: isSelected ? '#283B56' : 'transparent',
                            color: isSelected ? '#fff' : inMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: isSelected ? 700 : undefined,
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                        >
                          {format(day, 'd')}
                          {isCurrent && (
                            <span
                              className="absolute bottom-0 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full"
                              style={{ backgroundColor: isSelected ? '#fff' : '#EC1E2A' }}
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time picker */}
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hora</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Hour selector */}
                    <div
                      className="relative flex-1 rounded-lg border overflow-hidden"
                      style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="max-h-28 overflow-y-auto">
                        {HOURS.map((h) => (
                          <button
                            key={h}
                            onClick={() => setSelectedHour(h)}
                            className="flex w-full items-center justify-center py-1 text-xs transition-colors"
                            style={{
                              backgroundColor: selectedHour === h ? '#283B56' : 'transparent',
                              color: selectedHour === h ? '#fff' : 'var(--text-primary)',
                              fontWeight: selectedHour === h ? 700 : undefined,
                            }}
                            onMouseEnter={(e) => { if (selectedHour !== h) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                            onMouseLeave={(e) => { if (selectedHour !== h) e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>:</span>

                    {/* Minute selector */}
                    <div
                      className="relative flex-1 rounded-lg border overflow-hidden"
                      style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="max-h-28 overflow-y-auto">
                        {MINUTES.map((m) => (
                          <button
                            key={m}
                            onClick={() => setSelectedMinute(m)}
                            className="flex w-full items-center justify-center py-1 text-xs transition-colors"
                            style={{
                              backgroundColor: selectedMinute === m ? '#283B56' : 'transparent',
                              color: selectedMinute === m ? '#fff' : 'var(--text-primary)',
                              fontWeight: selectedMinute === m ? 700 : undefined,
                            }}
                            onMouseEnter={(e) => { if (selectedMinute !== m) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                            onMouseLeave={(e) => { if (selectedMinute !== m) e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div
                      className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-lg border px-2 text-sm font-semibold"
                      style={{
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {selectedHour}:{selectedMinute}
                    </div>
                  </div>
                </div>

                {/* Summary + Add button */}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {format(selectedDate, "d 'de' MMM", { locale: es })}, {selectedHour}:{selectedMinute}
                  </span>
                  <button
                    onClick={handleAddDatetime}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#EC1E2A' }}
                  >
                    Añadir
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'before' && (
              <div>
                {!hasDateTime ? (
                  <div>
                    <p
                      className="mb-3 flex items-center gap-2 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Info size={14} />
                      Primero añade una fecha y hora a la tarea.
                    </p>
                    <div className="flex items-center justify-between">
                      <HelpCircle size={14} style={{ color: 'var(--text-muted)' }} />
                      <button
                        disabled
                        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white opacity-50"
                        style={{ backgroundColor: '#6B7280' }}
                      >
                        Añadir recordatorio
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Before dropdown */}
                    <div className="relative mb-4">
                      <button
                        onClick={() => setBeforeDropdownOpen(!beforeDropdownOpen)}
                        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
                        style={{
                          borderColor: 'var(--border-primary)',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          {selectedBeforeLabel}
                        </div>
                        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                      </button>

                      {beforeDropdownOpen && (
                        <div
                          className="absolute left-0 top-full z-40 mt-1 w-full rounded-lg border shadow-lg"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-primary)',
                          }}
                        >
                          <div className="max-h-64 overflow-y-auto py-1">
                            {BEFORE_OPTIONS.map((option) => (
                              <button
                                key={option.minutes}
                                onClick={() => {
                                  setSelectedBeforeMinutes(option.minutes)
                                  setBeforeDropdownOpen(false)
                                }}
                                className="flex w-full items-center px-3 py-1.5 text-sm transition-colors"
                                style={{
                                  backgroundColor:
                                    selectedBeforeMinutes === option.minutes
                                      ? 'rgba(59,130,246,0.2)'
                                      : 'transparent',
                                  color: 'var(--text-primary)',
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedBeforeMinutes !== option.minutes)
                                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedBeforeMinutes !== option.minutes)
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleAddBefore}
                        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
                        style={{ backgroundColor: '#EC1E2A' }}
                      >
                        Añadir recordatorio
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Existing reminders */}
            {reminders.length > 0 && (
              <div
                className="mt-3 border-t pt-3"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                <p
                  className="mb-2 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Recordatorios activos
                </p>
                <div className="space-y-1.5">
                  {reminders.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-primary)' }}>
                        <Bell size={12} />
                        {r.label}
                      </div>
                      <button
                        onClick={() => onRemove(i)}
                        className="rounded p-0.5 transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = '#EC1E2A')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = 'var(--text-muted)')
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Resolve a ReminderConfig to an ISO datetime string for `remind_at`.
 */
export function resolveReminderConfig(
  config: ReminderConfig,
  dueDate: string | null,
  dueTime: string | null,
): string | null {
  if (config.type === 'datetime') {
    return typeof config.value === 'string' ? config.value : null
  }

  // 'before' type — need a due datetime
  if (!dueDate || !dueTime) return null
  const dueDatetime = new Date(`${dueDate}T${dueTime}:00`)
  const minutesBefore = config.value as number

  if (minutesBefore === 0) return dueDatetime.toISOString()

  // Subtract the appropriate duration
  let result: Date
  if (minutesBefore < 60) {
    result = subMinutes(dueDatetime, minutesBefore)
  } else if (minutesBefore < 1440) {
    result = subHours(dueDatetime, minutesBefore / 60)
  } else if (minutesBefore < 10080) {
    result = subDays(dueDatetime, minutesBefore / 1440)
  } else {
    result = subWeeks(dueDatetime, minutesBefore / 10080)
  }

  return result.toISOString()
}
