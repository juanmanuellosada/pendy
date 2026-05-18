import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Select } from '@/components/common/Select'
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
import { parseNLPTokens } from '@/services/dateParser'
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

// ── Mini calendar para selección de fecha de fin ──────────────────────────────
function MiniCalendar({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (d: string) => void
}) {
  const today = new Date()
  const selectedDate = selected ? parseLocalDate(selected) : null
  const [viewMonth, setViewMonth] = useState(() =>
    selected ? parseLocalDate(selected) : new Date(),
  )

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 }),
    })
  }, [viewMonth])

  return (
    <div
      className="mt-2 rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Navegación de mes */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <button
          type="button"
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
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded p-0.5 transition-colors"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <ChevronRight size={14} style={{ color: 'var(--text-primary)' }} />
        </button>
      </div>
      {/* Cabecera de días */}
      <div className="grid grid-cols-7 text-center px-1 mb-0.5">
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
      {/* Grilla */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center px-1 pb-2">
        {calendarDays.map((day) => {
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const isTodayDay = isSameDay(day, today)
          const isCurrentMonth = isSameMonth(day, viewMonth)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(format(day, 'yyyy-MM-dd'))}
              className="relative flex flex-col items-center justify-center rounded-md py-0.5 text-[11px] transition-colors"
              style={{
                backgroundColor: isSelected ? 'var(--color-primary)' : undefined,
                color: isSelected
                  ? '#fff'
                  : isCurrentMonth
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
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
              {isTodayDay && (
                <span
                  className="absolute bottom-0 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#fff' : 'var(--color-accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day-of-week toggles ────────────────────────────────────────────────────────
const WEEK_DAYS = [
  { label: 'Lu', value: 'MO' },
  { label: 'Ma', value: 'TU' },
  { label: 'Mi', value: 'WE' },
  { label: 'Ju', value: 'TH' },
  { label: 'Vi', value: 'FR' },
  { label: 'Sá', value: 'SA' },
  { label: 'Do', value: 'SU' },
] as const

const BYDAY_ORDER = WEEK_DAYS.map((d) => d.value)

// ── Calendar grid constants ────────────────────────────────────────────────────
const DAY_HEADERS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DAY_NAMES_SHORT_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatDuration(v: number): string {
  if (v < 60) return `${v}m`
  const h = Math.floor(v / 60)
  const m = v % 60
  return m === 0 ? `${h}h` : `${h}h${m}m`
}

// 5, 10, 15, ..., 120 en pasos de 5
const DURATION_PRESETS: { label: string; value: number | null }[] = [
  { label: 'Sin duración', value: null },
  ...Array.from({ length: 24 }, (_, i) => {
    const v = (i + 1) * 5
    return { label: formatDuration(v), value: v }
  }),
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
  onRecurrenceChange: (
    isRecurring: boolean,
    rule: string | null,
    from: 'due_date' | 'completion_date',
  ) => void
  shortcutKey?: string
  inline?: boolean
}

function generateRecurrencePresets(date: Date) {
  const dayOfWeek = getDay(date)
  const dayName = DAY_NAMES_ES[dayOfWeek]
  const dayOfMonth = date.getDate()
  const month = MONTH_NAMES_ES[date.getMonth()]
  const byDay = BYDAY[dayOfWeek]

  const presets = [
    { label: 'Cada día', rule: 'RRULE:FREQ=DAILY;INTERVAL=1' },
    { label: `Cada semana el ${dayName}`, rule: `RRULE:FREQ=WEEKLY;BYDAY=${byDay}` },
    { label: 'Cada día laborable (lun - vie)', rule: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
    { label: `Cada mes el ${dayOfMonth}`, rule: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}` },
  ]

  // Cuando el día es 29, 30 o 31 algunos meses lo omiten → ofrecer "último día del mes"
  if (dayOfMonth >= 29) {
    presets.push({ label: 'Último día de cada mes', rule: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1' })
  }

  presets.push({
    label: `Cada año el ${dayOfMonth} de ${month}`,
    rule: `RRULE:FREQ=YEARLY;BYMONTH=${date.getMonth() + 1};BYMONTHDAY=${dayOfMonth}`,
  })

  return presets
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
  shortcutKey,
  inline = false,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(inline)
  const [viewMonth, setViewMonth] = useState<Date>(() => (date ? parseLocalDate(date) : new Date()))
  const [timeExpanded, setTimeExpanded] = useState(false)
  const [repeatExpanded, setRepeatExpanded] = useState(false)
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false)
  const [showCustomDuration, setShowCustomDuration] = useState(false)

  // Custom recurrence dialog state
  const [customFreq, setCustomFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY')
  const [customInterval, setCustomInterval] = useState(1)
  const [customFrom, setCustomFrom] = useState<'due_date' | 'completion_date'>('due_date')
  const [customEndDate, setCustomEndDate] = useState<string | null>(null)
  const [customHasEnd, setCustomHasEnd] = useState(false)
  const [customDays, setCustomDays] = useState<string[]>([])
  const [customUseLastDay, setCustomUseLastDay] = useState(false)

  const [nlpText, setNlpText] = useState('')
  const nlpInputRef = useRef<HTMLInputElement>(null)

  // Build a human-readable NLP string from the current picker values
  const buildNLPText = useCallback((): string => {
    const parts: string[] = []
    const todayDate = new Date()

    // Date
    if (date) {
      const d = parseLocalDate(date)
      if (isSameDay(d, todayDate)) parts.push('hoy')
      else if (isSameDay(d, addDays(todayDate, 1))) parts.push('mañana')
      else parts.push(format(d, 'dd/MM/yyyy'))
    }

    // Time
    if (hasTime && time) parts.push(time)

    // Recurrence
    if (isRecurring && recurrenceRule) {
      const freqMatch = recurrenceRule.match(/FREQ=(\w+)/)
      const intervalMatch = recurrenceRule.match(/INTERVAL=(\d+)/)
      const bydayMatch = recurrenceRule.match(/BYDAY=([^;]+)/)
      const bymonthDayMatch = recurrenceRule.match(/BYMONTHDAY=(-?\d+)/)
      const untilMatch = recurrenceRule.match(/UNTIL=(\d{8})/)

      const freq = freqMatch?.[1] ?? ''
      const interval = intervalMatch ? parseInt(intervalMatch[1]!) : 1

      if (freq === 'WEEKLY' && bydayMatch) {
        const days = bydayMatch[1]!.split(',')
        const dayNameMap: Record<string, string> = {
          MO: 'lunes',
          TU: 'martes',
          WE: 'miércoles',
          TH: 'jueves',
          FR: 'viernes',
          SA: 'sábado',
          SU: 'domingo',
        }
        if (days.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => days.includes(d))) {
          parts.push('cada día laborable')
        } else if (days.length === 1) {
          parts.push(`cada ${dayNameMap[days[0]!] ?? days[0]}`)
        } else {
          parts.push(interval > 1 ? `cada ${interval} semanas` : 'cada semana')
        }
      } else if (freq === 'MONTHLY' && bymonthDayMatch?.[1] === '-1') {
        parts.push('cada mes')
      } else {
        const freqMap: Record<string, [string, string]> = {
          DAILY: ['cada día', 'cada %d días'],
          WEEKLY: ['cada semana', 'cada %d semanas'],
          MONTHLY: ['cada mes', 'cada %d meses'],
          YEARLY: ['cada año', 'cada %d años'],
        }
        const [singular, plural] = freqMap[freq] ?? ['cada día', 'cada %d días']
        parts.push(interval > 1 ? plural!.replace('%d', String(interval)) : singular!)
      }

      // End date
      if (untilMatch) {
        const y = untilMatch[1]!.slice(0, 4)
        const m = untilMatch[1]!.slice(4, 6)
        const d = untilMatch[1]!.slice(6, 8)
        parts.push(`fin ${d}/${m}/${y}`)
      }
    }

    return parts.join(' ')
  }, [date, time, hasTime, isRecurring, recurrenceRule])

  // Pre-fill NLP text when picker opens (or on mount for inline)
  useEffect(() => {
    if (open || inline) {
      setNlpText(buildNLPText())
    } else {
      setNlpText('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Also update NLP text when values change externally while open (e.g. clicking calendar)
  // but only if the user is not actively typing in the input
  useEffect(() => {
    if ((open || inline) && document.activeElement !== nlpInputRef.current) {
      setNlpText(buildNLPText())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, time, hasTime, isRecurring, recurrenceRule])

  const containerRef = useRef<HTMLDivElement>(null)
  const floatingStyle = useFloatingPosition(containerRef, open && !inline, 288) // w-72 = 288px
  const today = useMemo(() => new Date(), [])
  const selectedDate = useMemo(() => (date ? parseLocalDate(date) : null), [date])

  useEffect(() => {
    if (!open || inline) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCustomRecurrence(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, inline])

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
        color: 'var(--color-link)',
        action: handleThisWeekend,
      },
      {
        icon: ArrowRight,
        label: 'Próxima semana',
        hint: format(mon, 'EEE d MMM', { locale: es }),
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
    if (recurrenceRule) {
      const freqMatch = recurrenceRule.match(/FREQ=(\w+)/)
      const intervalMatch = recurrenceRule.match(/INTERVAL=(\d+)/)
      const untilMatch = recurrenceRule.match(/UNTIL=(\d{8})/)
      const bydayMatch = recurrenceRule.match(/BYDAY=([^;]+)/)
      const bymonthDayMatch = recurrenceRule.match(/BYMONTHDAY=(-?\d+)/)
      if (freqMatch) setCustomFreq(freqMatch[1]! as typeof customFreq)
      setCustomInterval(intervalMatch ? parseInt(intervalMatch[1]!) : 1)
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
      setCustomDays(
        bydayMatch && freqMatch?.[1] === 'WEEKLY' ? bydayMatch[1]!.split(',').filter(Boolean) : [],
      )
      setCustomUseLastDay(bymonthDayMatch?.[1] === '-1')
    } else {
      setCustomFreq('WEEKLY')
      setCustomInterval(1)
      setCustomEndDate(null)
      setCustomHasEnd(false)
      setCustomDays([])
      setCustomUseLastDay(false)
    }
    setCustomFrom(recurrenceFrom)
    setShowCustomRecurrence(true)
  }, [recurrenceRule, recurrenceFrom])

  const handleSaveCustomRecurrence = useCallback(() => {
    let rule = `RRULE:FREQ=${customFreq}`
    if (customInterval > 1) rule += `;INTERVAL=${customInterval}`
    if (customFreq === 'WEEKLY' && customDays.length > 0) {
      const sorted = BYDAY_ORDER.filter((d) => customDays.includes(d))
      rule += `;BYDAY=${sorted.join(',')}`
    }
    if (customFreq === 'MONTHLY' && customUseLastDay) {
      rule += ';BYMONTHDAY=-1'
    }
    if (customHasEnd && customEndDate) {
      const untilStr = customEndDate.replace(/-/g, '')
      rule += `;UNTIL=${untilStr}T235959Z`
    }
    onRecurrenceChange(true, rule, customFrom)
    setShowCustomRecurrence(false)
  }, [
    customFreq,
    customInterval,
    customDays,
    customUseLastDay,
    customHasEnd,
    customEndDate,
    customFrom,
    onRecurrenceChange,
  ])

  // ── NLP text input ───────────────────────────────────────────────────────────
  // Parse "fin [date]" from the NLP text, returning { endDate, stripped }
  const parseNLPEndDate = useCallback(
    (text: string): { endDate: string | null; stripped: string } => {
      const t = new Date()
      // "fin YYYY-MM-DD"
      let m = text.match(/\bfin\s+(\d{4})-(\d{2})-(\d{2})\b/i)
      if (m) {
        return { endDate: `${m[1]}-${m[2]}-${m[3]}`, stripped: text.replace(m[0], '').trim() }
      }
      // "fin DD/MM/YYYY" or "fin DD/MM" or "fin DD-MM-YYYY" or "fin DD-MM"
      m = text.match(/\bfin\s+(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b/i)
      if (m) {
        const day = parseInt(m[1]!)
        const month = parseInt(m[2]!)
        const rawYear = m[3] ? parseInt(m[3]) : null
        const year = rawYear !== null ? (rawYear < 100 ? 2000 + rawYear : rawYear) : t.getFullYear()
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
          return {
            endDate: format(new Date(year, month - 1, day), 'yyyy-MM-dd'),
            stripped: text.replace(m[0], '').trim(),
          }
        }
      }
      return { endDate: null, stripped: text }
    },
    [],
  )

  // Live preview of NLP text
  const nlpPreview = useMemo(() => {
    if (!nlpText.trim()) return null
    const { endDate, stripped } = parseNLPEndDate(nlpText)
    const parsed = parseNLPTokens(stripped)
    const chips: { label: string; color: string }[] = []
    if (parsed.date) {
      const d = parseLocalDate(parsed.date)
      let label = ''
      if (isSameDay(d, new Date())) label = 'Hoy'
      else {
        const tomorrow = addDays(new Date(), 1)
        if (isSameDay(d, tomorrow)) label = 'Mañana'
        else label = format(d, "d 'de' MMM", { locale: es })
      }
      if (parsed.hasTime && parsed.time) label += ` ${parsed.time}`
      chips.push({ label, color: '#22C55E' })
    }
    if (parsed.durationMinutes !== null) {
      chips.push({ label: formatDuration(parsed.durationMinutes), color: '#8B5CF6' })
    }
    if (parsed.isRecurring && parsed.recurrenceRule) {
      const freqMatch = parsed.recurrenceRule.match(/FREQ=(\w+)/)
      const intervalMatch = parsed.recurrenceRule.match(/INTERVAL=(\d+)/)
      const freq = freqMatch?.[1] ?? ''
      const interval = intervalMatch ? parseInt(intervalMatch[1]!) : 1
      const labels: Record<string, string> = {
        DAILY: interval > 1 ? `Cada ${interval} días` : 'Cada día',
        WEEKLY: interval > 1 ? `Cada ${interval} sem.` : 'Cada semana',
        MONTHLY: interval > 1 ? `Cada ${interval} meses` : 'Cada mes',
        YEARLY: interval > 1 ? `Cada ${interval} años` : 'Cada año',
      }
      chips.push({ label: labels[freq] ?? 'Repite', color: '#F59E0B' })
    }
    if (endDate) {
      chips.push({
        label: `Fin ${format(parseLocalDate(endDate), 'd MMM', { locale: es })}`,
        color: '#EC1E2A',
      })
    }
    return chips.length > 0 ? chips : null
  }, [nlpText, parseNLPEndDate])

  const handleNLPApply = useCallback(() => {
    if (!nlpText.trim()) return
    const { endDate, stripped } = parseNLPEndDate(nlpText)
    const parsed = parseNLPTokens(stripped)

    if (parsed.date) {
      const d = parseLocalDate(parsed.date)
      onDateChange(parsed.date)
      setViewMonth(d)
    }
    if (parsed.hasTime && parsed.time) {
      onHasTimeChange(true)
      onTimeChange(parsed.time)
      setTimeExpanded(true)
    }
    if (parsed.durationMinutes !== null) {
      onDurationChange(parsed.durationMinutes)
    }
    if (parsed.isRecurring && parsed.recurrenceRule) {
      let rule = parsed.recurrenceRule
      if (endDate) {
        rule += `;UNTIL=${endDate.replace(/-/g, '')}T235959Z`
      }
      onRecurrenceChange(true, rule, recurrenceFrom)
      setRepeatExpanded(true)
    } else if (endDate && isRecurring && recurrenceRule) {
      // Add/replace end date in existing rule
      let rule = recurrenceRule.replace(/;UNTIL=[^;]+/, '')
      rule += `;UNTIL=${endDate.replace(/-/g, '')}T235959Z`
      onRecurrenceChange(true, rule, recurrenceFrom)
    }
    setNlpText('')
  }, [
    nlpText,
    parseNLPEndDate,
    onDateChange,
    onHasTimeChange,
    onTimeChange,
    onDurationChange,
    onRecurrenceChange,
    recurrenceFrom,
    isRecurring,
    recurrenceRule,
  ])

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
    return formatDuration(durationMinutes)
  }, [durationMinutes])

  // Recurrence summary for trigger button
  const recurrenceSummary = useMemo(() => {
    if (!isRecurring || !recurrenceRule) return null
    const d = selectedDate ?? today
    const presets = generateRecurrencePresets(d)
    const match = presets.find((p) => p.rule === recurrenceRule)
    if (match) return match.label
    const freqMatch = recurrenceRule.match(/FREQ=(\w+)/)
    const intervalMatch = recurrenceRule.match(/INTERVAL=(\d+)/)
    const bydayMatch = recurrenceRule.match(/BYDAY=([^;]+)/)
    const bymonthDayMatch = recurrenceRule.match(/BYMONTHDAY=(-?\d+)/)
    if (freqMatch) {
      const freq = freqMatch[1]!
      const interval = intervalMatch ? parseInt(intervalMatch[1]!) : 1
      if (freq === 'MONTHLY' && bymonthDayMatch?.[1] === '-1') {
        return interval > 1 ? `Último día cada ${interval} meses` : 'Último día del mes'
      }
      if (freq === 'WEEKLY' && bydayMatch) {
        const dayMap: Record<string, string> = {
          MO: 'lun',
          TU: 'mar',
          WE: 'mié',
          TH: 'jue',
          FR: 'vie',
          SA: 'sáb',
          SU: 'dom',
        }
        const days = bydayMatch[1]!.split(',').map((x) => dayMap[x] ?? x)
        const prefix = interval > 1 ? `Cada ${interval} sem: ` : ''
        return `${prefix}${days.join(', ')}`
      }
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
    <div ref={containerRef} className={inline ? '' : 'relative inline-block'}>
      {/* Trigger button — only in non-inline mode */}
      {!inline && (
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
          {isRecurring && <Repeat size={12} style={{ color: 'var(--text-muted)' }} />}
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
          {shortcutKey && (
            <span
              className="rounded px-1 py-0.5 font-mono text-[9px] leading-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              {shortcutKey}
            </span>
          )}
        </button>
      )}

      {(inline || open) && !showCustomRecurrence && (
        <div
          className={
            inline
              ? 'w-[min(288px,100vw-32px)] overflow-hidden'
              : 'w-[min(288px,100vw-32px)] rounded-xl shadow-xl overflow-y-auto'
          }
          style={{
            ...(inline ? {} : floatingStyle),
            backgroundColor: 'var(--bg-primary)',
            ...(inline ? {} : { border: '1px solid var(--border-primary)' }),
          }}
        >
          {/* Date header */}
          <div
            className="px-3 pt-3 pb-1 text-xs font-semibold capitalize"
            style={{ color: 'var(--text-muted)' }}
          >
            {dateHeaderLabel}
          </div>

          {/* NLP text input */}
          <div className="px-3 pb-2">
            <div
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
              style={{
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <input
                ref={nlpInputRef}
                type="text"
                value={nlpText}
                onChange={(e) => setNlpText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleNLPApply()
                  } else if (e.key === 'Escape') {
                    setNlpText('')
                  }
                }}
                placeholder="ej: mañana 14:00 cada semana fin 30/06"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {nlpText && (
                <button
                  type="button"
                  onClick={handleNLPApply}
                  className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
                >
                  ↵
                </button>
              )}
            </div>
            {nlpPreview && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {nlpPreview.map((chip) => (
                  <span
                    key={chip.label}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: chip.color + '22',
                      color: chip.color,
                      border: `1px solid ${chip.color}44`,
                    }}
                  >
                    {chip.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

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
              <span
                className="text-sm font-semibold capitalize"
                style={{ color: 'var(--text-primary)' }}
              >
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
                <span
                  key={d}
                  className="py-0.5 text-xs font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
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
                      backgroundColor: isSelected ? 'var(--color-primary)' : undefined,
                      color: isSelected
                        ? '#fff'
                        : isCurrentMonth
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
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
                        style={{ backgroundColor: isSelected ? '#fff' : 'var(--color-accent)' }}
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
                {/* HH : MM selects */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Select
                    value={(time ?? '09:00').split(':')[0]!}
                    options={Array.from({ length: 24 }, (_, i) => {
                      const h = String(i).padStart(2, '0')
                      return { value: h, label: h }
                    })}
                    onChange={(h) => {
                      const m = (time ?? '09:00').split(':')[1] ?? '00'
                      onTimeChange(`${h}:${m}`)
                      if (!hasTime) onHasTimeChange(true)
                    }}
                    style={{ backgroundColor: 'var(--bg-secondary)', minWidth: 0 }}
                    className="w-16 text-center font-medium"
                  />
                  <span
                    className="text-sm font-medium select-none px-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    :
                  </span>
                  <Select
                    value={String(
                      (Math.round(parseInt((time ?? '09:00').split(':')[1] ?? '0') / 5) * 5) % 60,
                    ).padStart(2, '0')}
                    options={Array.from({ length: 12 }, (_, i) => {
                      const m = String(i * 5).padStart(2, '0')
                      return { value: m, label: m }
                    })}
                    onChange={(m) => {
                      const h = (time ?? '09:00').split(':')[0] ?? '09'
                      onTimeChange(`${h}:${m}`)
                      if (!hasTime) onHasTimeChange(true)
                    }}
                    style={{ backgroundColor: 'var(--bg-secondary)', minWidth: 0 }}
                    className="w-16 text-center font-medium"
                  />
                </div>

                {/* Duración — intervalos de 5 min + Personalizado */}
                {showCustomDuration ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={480}
                      autoFocus
                      placeholder="min"
                      defaultValue={durationMinutes ?? ''}
                      onBlur={(e) => {
                        const v = parseInt(e.target.value)
                        onDurationChange(isNaN(v) || v <= 0 ? null : v)
                        setShowCustomDuration(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') {
                          onDurationChange(null)
                          setShowCustomDuration(false)
                        }
                      }}
                      className="flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: 'var(--color-primary)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      min
                    </span>
                  </div>
                ) : (
                  <Select
                    value={(() => {
                      if (durationMinutes === null) return ''
                      const isPreset = DURATION_PRESETS.some((p) => p.value === durationMinutes)
                      return isPreset ? String(durationMinutes) : 'custom'
                    })()}
                    options={[
                      ...DURATION_PRESETS.map((opt) => ({
                        value: opt.value !== null ? String(opt.value) : '',
                        label: opt.label,
                      })),
                      ...(durationMinutes !== null &&
                      !DURATION_PRESETS.some((p) => p.value === durationMinutes)
                        ? [{ value: 'custom', label: formatDuration(durationMinutes) }]
                        : []),
                      { value: 'custom_new', label: 'Personalizado...' },
                    ]}
                    onChange={(val) => {
                      if (val === 'custom' || val === 'custom_new') {
                        setShowCustomDuration(true)
                      } else {
                        onDurationChange(val === '' ? null : parseInt(val, 10))
                      }
                    }}
                    className="flex-1 text-xs"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  />
                )}
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
                      style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="flex-1 text-left">{preset.label}</span>
                      {isActive && <Check size={14} style={{ color: 'var(--color-primary)' }} />}
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
      {(inline || open) && showCustomRecurrence && (
        <div
          className={
            inline
              ? 'w-[min(288px,100vw-32px)] p-4'
              : 'w-[min(288px,100vw-32px)] rounded-xl p-4 shadow-xl'
          }
          style={{
            ...(inline ? {} : floatingStyle),
            backgroundColor: 'var(--bg-primary)',
            ...(inline ? {} : { border: '1px solid var(--border-primary)' }),
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
            <span
              className="mb-1.5 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Según la
            </span>
            <div className="flex flex-col gap-1.5">
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="radio"
                  name="recurrence-from"
                  checked={customFrom === 'due_date'}
                  onChange={() => setCustomFrom('due_date')}
                  className="accent-[var(--color-primary)]"
                />
                Fecha en la que se programe
              </label>
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="radio"
                  name="recurrence-from"
                  checked={customFrom === 'completion_date'}
                  onChange={() => setCustomFrom('completion_date')}
                  className="accent-[var(--color-primary)]"
                />
                Fecha en la que se complete
              </label>
            </div>
          </div>

          {/* Cada */}
          <div className="mb-3">
            <span
              className="mb-1.5 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
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
              <Select
                value={customFreq}
                options={[...FREQ_OPTIONS]}
                onChange={(val) => setCustomFreq(val as typeof customFreq)}
                className="flex-1 text-xs"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
          </div>

          {/* Último día del mes (solo cuando es mensual) */}
          {customFreq === 'MONTHLY' && (
            <div className="mb-3">
              <label
                className="flex items-center gap-2 text-xs cursor-pointer select-none"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="checkbox"
                  checked={customUseLastDay}
                  onChange={(e) => setCustomUseLastDay(e.target.checked)}
                  className="accent-[var(--color-primary)]"
                />
                Siempre el último día del mes
              </label>
              {customUseLastDay && (
                <p className="mt-1 text-[11px] pl-5" style={{ color: 'var(--text-muted)' }}>
                  En meses cortos se usará el último día (ej: feb 28/29, abr 30).
                </p>
              )}
            </div>
          )}

          {/* Días (solo cuando es semanal) */}
          {customFreq === 'WEEKLY' && (
            <div className="mb-3">
              <span
                className="mb-1.5 block text-xs font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Días
              </span>
              <div className="flex gap-1">
                {WEEK_DAYS.map(({ label, value }) => {
                  const isOn = customDays.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setCustomDays((prev) =>
                          prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value],
                        )
                      }
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: isOn ? 'var(--color-primary)' : 'var(--bg-secondary)',
                        color: isOn ? '#fff' : 'var(--text-muted)',
                        border: `1px solid ${isOn ? 'var(--color-primary)' : 'var(--border-primary)'}`,
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Finaliza */}
          <div className="mb-4">
            <span
              className="mb-1.5 block text-xs font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Finaliza
            </span>
            <div className="flex flex-col gap-1.5">
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={!customHasEnd}
                  onChange={() => {
                    setCustomHasEnd(false)
                    setCustomEndDate(null)
                  }}
                  className="accent-[var(--color-primary)]"
                />
                Nunca
              </label>
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                <input
                  type="radio"
                  name="recurrence-end"
                  checked={customHasEnd}
                  onChange={() => setCustomHasEnd(true)}
                  className="accent-[var(--color-primary)]"
                />
                En la fecha
              </label>
              {customHasEnd && (
                <MiniCalendar
                  key={customEndDate ?? 'empty'}
                  selected={customEndDate}
                  onSelect={setCustomEndDate}
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
              style={{ backgroundColor: 'var(--color-primary)' }}
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
