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
  nextSaturday,
  isToday as isDateToday,
  isTomorrow as isDateTomorrow,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { parseLocalDate } from '@/lib/utils'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Sun,
  Sofa,
  CalendarDays,
  ArrowRight,
  Circle,
  Repeat,
  ChevronDown,
  Check,
} from 'lucide-react'

const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DAY_NAMES_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DURATION_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'Sin duración', value: null },
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '1h30m', value: 90 },
  { label: '2h', value: 120 },
]

interface DateTimePickerProps {
  date: string | null
  time: string | null
  hasTime: boolean
  durationMinutes: number | null
  isRecurring: boolean
  recurrenceRule: string | null
  recurrenceFrom: 'due_date' | 'completion_date'
  onDateChange: (date: string | null) => void
  onTimeChange: (time: string | null) => void
  onHasTimeChange: (hasTime: boolean) => void
  onDurationChange: (minutes: number | null) => void
  onRecurrenceChange: (isRecurring: boolean, rule: string | null, from: 'due_date' | 'completion_date') => void
}

function generateRecurrencePresets(date: Date) {
  const dayOfWeek = getDay(date)
  const dayName = DAY_NAMES_ES[dayOfWeek]
  const dayOfMonth = date.getDate()
  const month = MONTH_NAMES_ES[date.getMonth()]
  const byDay = BYDAY[dayOfWeek]

  return [
    { label: 'Cada día', rule: 'RRULE:FREQ=DAILY;INTERVAL=1' },
    { label: `Cada semana el ${dayName}`, rule: `RRULE:FREQ=WEEKLY;BYDAY=${byDay}` },
    { label: 'Cada día laborable (lun - vie)', rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { label: `Cada mes el ${dayOfMonth}`, rule: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}` },
    { label: `Cada año el ${dayOfMonth} de ${month}`, rule: `RRULE:FREQ=YEARLY;BYMONTH=${date.getMonth() + 1};BYMONTHDAY=${dayOfMonth}` },
  ]
}

const FREQ_OPTIONS = [
  { label: 'día', value: 'DAILY' },
  { label: 'semana', value: 'WEEKLY' },
  { label: 'mes', value: 'MONTHLY' },
  { label: 'año', value: 'YEARLY' },
] as const

export function DateTimePicker({
  date,
  time,
  hasTime,
  durationMinutes,
  isRecurring,
  recurrenceRule,
  recurrenceFrom,
  onDateChange,
  onTimeChange,
  onHasTimeChange,
  onDurationChange,
  onRecurrenceChange,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(() => (date ? parseLocalDate(date) : new Date()))
  const [timeExpanded, setTimeExpanded] = useState(false)
  const [repeatExpanded, setRepeatExpanded] = useState(false)
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false)

  // Custom recurrence dialog state
  const [customFreq, setCustomFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY')
  const [customInterval, setCustomInterval] = useState(1)
  const [customFrom, setCustomFrom] = useState<'due_date' | 'completion_date'>('due_date')
  const [customEndDate, setCustomEndDate] = useState<string | null>(null)
  const [customHasEnd, setCustomHasEnd] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const floatingStyle = useFloatingPosition(containerRef, open, 288) // w-72 = 288px
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(() => (date ? parseLocalDate(date) : null), [date])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustomRecurrence(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sync viewMonth when date changes externally
  useEffect(() => {
    if (date) setViewMonth(parseLocalDate(date))
  }, [date])

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
    onRecurrenceChange(false, null, 'due_date')
  }, [onDateChange, onTimeChange, onHasTimeChange, onDurationChange, onRecurrenceChange])

  // Quick shortcuts
  const handleToday = useCallback(() => {
    onDateChange(format(today, 'yyyy-MM-dd'))
    setViewMonth(today)
  }, [today, onDateChange])

  const handleTomorrow = useCallback(() => {
    const t = addDays(today, 1)
    onDateChange(format(t, 'yyyy-MM-dd'))
    setViewMonth(t)
  }, [today, onDateChange])

  const handleThisWeekend = useCallback(() => {
    const sat = nextSaturday(today)
    onDateChange(format(sat, 'yyyy-MM-dd'))
    setViewMonth(sat)
  }, [today, onDateChange])

  const handleNextWeek = useCallback(() => {
    const dayOfWeek = getDay(today)
    // If today is Sunday (0), next Monday is tomorrow
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const mon = addDays(today, daysUntilMonday)
    onDateChange(format(mon, 'yyyy-MM-dd'))
    setViewMonth(mon)
  }, [today, onDateChange])

  const handleNoDate = useCallback(() => {
    handleClear()
    setOpen(false)
  }, [handleClear])

  // Shortcut labels with weekday hints
  const shortcuts = useMemo(() => {
    const tomorrow = addDays(today, 1)
    const dayOfWeek = getDay(today)
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
    const mon = addDays(today, daysUntilMonday)
    const sat = nextSaturday(today)

    return [
      {
        icon: Sun,
        label: 'Hoy',
        hint: DAY_NAMES_SHORT_ES[getDay(today)],
        color: '#22C55E',
        action: handleToday,
      },
      {
        icon: CalendarDays,
        label: 'Mañana',
        hint: DAY_NAMES_SHORT_ES[getDay(tomorrow)],
        color: '#F59E0B',
        action: handleTomorrow,
      },
      {
        icon: Sofa,
        label: 'Este fin de semana',
        hint: format(sat, 'd MMM', { locale: es }),
        color: '#3B82F6',
        action: handleThisWeekend,
      },
      {
        icon: ArrowRight,
        label: 'Próxima semana',
        hint: format(mon, "EEE d MMM", { locale: es }),
        color: '#8B5CF6',
        action: handleNextWeek,
      },
      {
        icon: Circle,
        label: 'Sin fecha',
        hint: '',
        color: 'var(--text-muted)',
        action: handleNoDate,
      },
    ]
  }, [today, handleToday, handleTomorrow, handleThisWeekend, handleNextWeek, handleNoDate])

  // Time toggle
  const handleTimeToggle = useCallback(() => {
    if (timeExpanded) {
      // Collapsing — clear time if desired
      setTimeExpanded(false)
    } else {
      setTimeExpanded(true)
      if (!hasTime) {
        onHasTimeChange(true)
        if (!time) onTimeChange('09:00')
      }
    }
  }, [timeExpanded, hasTime, time, onHasTimeChange, onTimeChange])

  const handleClearTime = useCallback(() => {
    onHasTimeChange(false)
    onTimeChange(null)
    onDurationChange(null)
    setTimeExpanded(false)
  }, [onHasTimeChange, onTimeChange, onDurationChange])

  // Recurrence presets based on selected date
  const recurrencePresets = useMemo(() => {
    const d = selectedDate ?? today
    return generateRecurrencePresets(d)
  }, [selectedDate, today])

  const handleRecurrencePreset = useCallback(
    (rule: string) => {
      if (recurrenceRule === rule) {
        // Toggle off
        onRecurrenceChange(false, null, 'due_date')
      } else {
        onRecurrenceChange(true, rule, recurrenceFrom)
      }
    },
    [recurrenceRule, recurrenceFrom, onRecurrenceChange],
  )

  const handleClearRecurrence = useCallback(() => {
    onRecurrenceChange(false, null, 'due_date')
    setRepeatExpanded(false)
  }, [onRecurrenceChange])

  // Open custom recurrence dialog
  const openCustomRecurrence = useCallback(() => {
    // Parse current rule if present
    if (recurrenceRule) {
      const freqMatch = recurrenceRule.match(/FREQ=(\w+)/)
      const intervalMatch = recurrenceRule.match(/INTERVAL=(\d+)/)
      const untilMatch = recurrenceRule.match(/UNTIL=(\d{8})/)
      if (freqMatch) setCustomFreq(freqMatch[1]! as typeof customFreq)
      if (intervalMatch) setCustomInterval(parseInt(intervalMatch[1]!))
      if (untilMatch) {
        const y = untilMatch[1]!.slice(0, 4)
        const m = untilMatch[1]!.slice(4, 6)
        const d = untilMatch[1]!.slice(6, 8)
        setCustomEndDate(`${y}-${m}-${d}`)
        setCustomHasEnd(true)
      } else {
        setCustomEndDate(null)
        setCustomHasEnd(false)
      }
    } else {
      setCustomFreq('WEEKLY')
      setCustomInterval(1)
      setCustomEndDate(null)
      setCustomHasEnd(false)
    }
    setCustomFrom(recurrenceFrom)
    setShowCustomRecurrence(true)
  }, [recurrenceRule, recurrenceFrom])

  const handleSaveCustomRecurrence = useCallback(() => {
    let rule = `RRULE:FREQ=${customFreq}`
    if (customInterval > 1) rule += `;INTERVAL=${customInterval}`
    if (customHasEnd && customEndDate) {
      const untilStr = customEndDate.replace(/-/g, '')
      rule += `;UNTIL=${untilStr}T235959Z`
    }
    onRecurrenceChange(true, rule, customFrom)
    setShowCustomRecurrence(false)
  }, [customFreq, customInterval, customHasEnd, customEndDate, customFrom, onRecurrenceChange])

  // Trigger label — includes time + duration when set
  const triggerLabel = useMemo(() => {
    if (!selectedDate) return null
    let label = ''
    if (isDateToday(selectedDate)) label = 'Hoy'
    else if (isDateTomorrow(selectedDate)) label = 'Mañana'
    else label = format(selectedDate, "d 'de' MMMM", { locale: es })

    if (hasTime && time) label += ` ${time}`
    if (durationMinutes !== null && durationMinutes > 0) {
      if (durationMinutes >= 60) {
        const h = Math.floor(durationMinutes / 60)
        const m = durationMinutes % 60
        label += m > 0 ? ` · ${h}h${m}m` : ` · ${h}h`
      } else {
        label += ` · ${durationMinutes}min`
      }
    }
    return label
  }, [selectedDate, hasTime, time, durationMinutes])

  const triggerColor = useMemo(() => {
    if (!selectedDate) return 'var(--text-muted)'
    if (isDateToday(selectedDate)) return '#22C55E'
    return 'var(--text-primary)'
  }, [selectedDate])

  // Date display at top of dropdown
  const dateHeaderLabel = useMemo(() => {
    if (!selectedDate) return format(today, 'd MMM', { locale: es })
    return format(selectedDate, 'd MMM', { locale: es })
  }, [selectedDate, today])

  // Expand time section if hasTime is already set
  useEffect(() => {
    if (hasTime) setTimeExpanded(true)
  }, [hasTime])

  // Expand repeat section if recurring
  useEffect(() => {
    if (isRecurring) setRepeatExpanded(true)
  }, [isRecurring])

  // Duration label
  const durationLabel = useMemo(() => {
    if (durationMinutes === null) return null
    const opt = DURATION_OPTIONS.find((o) => o.value === durationMinutes)
    return opt ? opt.label : `${durationMinutes}m`
  }, [durationMinutes])

  // Recurrence summary for trigger button
  const recurrenceSummary = useMemo(() => {
    if (!isRecurring || !recurrenceRule) return null
    // Check against presets
    const d = selectedDate ?? today
    const presets = generateRecurrencePresets(d)
    const match = presets.find((p) => p.rule === recurrenceRule)
    if (match) return match.label
    // Parse custom
    const freqMatch = recurrenceRule.match(/FREQ=(\w+)/)
    const intervalMatch = recurrenceRule.match(/INTERVAL=(\d+)/)
    if (freqMatch) {
      const freq = freqMatch[1]!
      const interval = intervalMatch ? parseInt(intervalMatch[1]!) : 1
      const freqLabels: Record<string, string> = {
        DAILY: interval > 1 ? `Cada ${interval} días` : 'Cada día',
        WEEKLY: interval > 1 ? `Cada ${interval} semanas` : 'Cada semana',
        MONTHLY: interval > 1 ? `Cada ${interval} meses` : 'Cada mes',
        YEARLY: interval > 1 ? `Cada ${interval} años` : 'Cada año',
      }
      return freqLabels[freq] ?? 'Personalizada'
    }
    return 'Personalizada'
  }, [isRecurring, recurrenceRule, selectedDate, today])

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
        style={{ color: triggerColor }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <Calendar size={14} />
        <span>{triggerLabel ?? 'Fecha'}</span>
        {isRecurring && (
          <Repeat size={12} style={{ color: 'var(--text-muted)' }} />
        )}
        {selectedDate && (
          <span
            className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10"
            onClick={(e) => {
              e.stopPropagation()
              handleClear()
            }}
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && !showCustomRecurrence && (
        <div
          className="w-72 rounded-xl shadow-xl overflow-hidden"
          style={{
            ...floatingStyle,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {/* Date header */}
          <div
            className="px-3 pt-3 pb-1 text-xs font-semibold capitalize"
            style={{ color: 'var(--text-muted)' }}
          >
            {dateHeaderLabel}
          </div>

          {/* Quick shortcuts */}
          <div className="px-1 py-1">
            {shortcuts.map(({ icon: Icon, label, hint, color, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Icon size={16} style={{ color }} />
                <span className="flex-1 text-left">{label}</span>
                {hint && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {hint}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* Calendar */}
          <div className="px-3 pt-2 pb-1">
            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between">
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
                <span key={d} className="py-0.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
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
          </div>

          <div className="mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* Time section — collapsible */}
          <div className="px-1 py-1">
            <button
              type="button"
              onClick={handleTimeToggle}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{ color: hasTime ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Clock size={16} />
              <span className="flex-1 text-left">Hora</span>
              {hasTime && time && (
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {time}
                  {durationLabel && ` · ${durationLabel}`}
                </span>
              )}
              {hasTime && (
                <span
                  className="rounded-full p-0.5 transition-colors hover:bg-black/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearTime()
                  }}
                >
                  <X size={12} style={{ color: 'var(--text-muted)' }} />
                </span>
              )}
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-muted)',
                  transform: timeExpanded ? 'rotate(180deg)' : undefined,
                  transition: 'transform 0.15s',
                }}
              />
            </button>

            {timeExpanded && (
              <div className="px-3 pb-2 pt-1 flex items-center gap-2">
                <input
                  type="time"
                  value={time ?? '09:00'}
                  onChange={(e) => {
                    onTimeChange(e.target.value || null)
                    if (!hasTime) onHasTimeChange(true)
                  }}
                  className="w-24 rounded-lg border px-2 py-1.5 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <select
                  value={durationMinutes ?? ''}
                  onChange={(e) => {
                    const val = e.target.value
                    onDurationChange(val === '' ? null : parseInt(val, 10))
                  }}
                  className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none appearance-none cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.label} value={opt.value ?? ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

          {/* Repeat section — collapsible */}
          <div className="px-1 py-1">
            <button
              type="button"
              onClick={() => setRepeatExpanded((v) => !v)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              style={{ color: isRecurring ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Repeat size={16} />
              <span className="flex-1 text-left">Repetir</span>
              {isRecurring && recurrenceSummary && (
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {recurrenceSummary}
                </span>
              )}
              {isRecurring && (
                <span
                  className="rounded-full p-0.5 transition-colors hover:bg-black/10"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearRecurrence()
                  }}
                >
                  <X size={12} style={{ color: 'var(--text-muted)' }} />
                </span>
              )}
              <ChevronDown
                size={14}
                style={{
                  color: 'var(--text-muted)',
                  transform: repeatExpanded ? 'rotate(180deg)' : undefined,
                  transition: 'transform 0.15s',
                }}
              />
            </button>

            {repeatExpanded && (
              <div className="pb-1">
                {recurrencePresets.map((preset) => {
                  const isActive = recurrenceRule === preset.rule
                  return (
                    <button
                      key={preset.rule}
                      type="button"
                      onClick={() => handleRecurrencePreset(preset.rule)}
                      className="flex w-full items-center gap-3 rounded-lg px-6 py-1.5 text-xs transition-colors"
                      style={{ color: isActive ? '#283B56' : 'var(--text-secondary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="flex-1 text-left">{preset.label}</span>
                      {isActive && (
                        <Check size={14} style={{ color: '#283B56' }} />
                      )}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={openCustomRecurrence}
                  className="flex w-full items-center gap-3 rounded-lg px-6 py-1.5 text-xs transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span className="flex-1 text-left">Personalizada...</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom recurrence dialog */}
      {open && showCustomRecurrence && (
        <div
          className="w-72 rounded-xl p-4 shadow-xl"
          style={{
            ...floatingStyle,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Repetición personalizada
            </span>
            <button
              type="button"
              onClick={() => setShowCustomRecurrence(false)}
              className="rounded p-1 transition-colors"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Según la */}
          <div className="mb-3">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Según la
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="recurrence-from"
                  checked={customFrom === 'due_date'}
                  onChange={() => setCustomFrom('due_date')}
                  className="accent-[#283B56]"
                />
                Fecha en la que se programe
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="recurrence-from"
                  checked={customFrom === 'completion_date'}
                  onChange={() => setCustomFrom('completion_date')}
                  className="accent-[#283B56]"
                />
                Fecha en la que se complete
              </label>
            </div>
          </div>

          {/* Cada */}
          <div className="mb-3">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Cada
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={99}
                value={customInterval}
                onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 rounded-lg border px-2 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <select
                value={customFreq}
                onChange={(e) => setCustomFreq(e.target.value as typeof customFreq)}
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none appearance-none cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                {FREQ_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Finaliza */}
          <div className="mb-4">
            <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Finaliza
            </span>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={!customHasEnd}
                  onChange={() => {
                    setCustomHasEnd(false)
                    setCustomEndDate(null)
                  }}
                  className="accent-[#283B56]"
                />
                Nunca
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={customHasEnd}
                  onChange={() => setCustomHasEnd(true)}
                  className="accent-[#283B56]"
                />
                En la fecha
              </label>
              {customHasEnd && (
                <input
                  type="date"
                  value={customEndDate ?? ''}
                  onChange={(e) => setCustomEndDate(e.target.value || null)}
                  className="ml-5 rounded-lg border px-2 py-1.5 text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCustomRecurrence(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveCustomRecurrence}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: '#283B56' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
