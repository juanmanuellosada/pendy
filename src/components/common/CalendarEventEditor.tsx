import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  X,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  AlignLeft,
  Loader2,
  Bell,
  RefreshCw,
  ChevronDown,
  Check,
  Plus,
  BellOff,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useCalendarEventMutations } from '@/hooks/useCalendarEvents'
import { useCalendarIntegrations, useGoogleCalendarList } from '@/hooks/useCalendarIntegrations'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useIsMobile } from '@/hooks/useIsMobile'
import type { CalendarEvent, CalendarEventReminder } from '@/lib/types'

// ── Internal types ─────────────────────────────────────────────────────────────

type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
type DayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

interface CustomRec {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  days: DayCode[]
  endType: 'never' | 'count' | 'until'
  count: number
  until: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function dateToInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function timeToInputValue(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function parseTime(s: string): { h: number; m: number } {
  const [h = '0', m = '0'] = s.split(':')
  return { h: parseInt(h, 10), m: parseInt(m, 10) }
}

const DAY_LABELS: Record<DayCode, string> = {
  MO: 'Lu',
  TU: 'Ma',
  WE: 'Mi',
  TH: 'Ju',
  FR: 'Vi',
  SA: 'Sá',
  SU: 'Do',
}
const ALL_DAYS: DayCode[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const DOW_TO_CODE: DayCode[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const MONTH_NAMES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ── RRULE parsing ──────────────────────────────────────────────────────────────

function parseRRuleToState(recurrence?: string[]): { preset: RecurrencePreset; custom: CustomRec } {
  const defaultCustom: CustomRec = {
    freq: 'WEEKLY',
    interval: 1,
    days: ['MO'],
    endType: 'never',
    count: 5,
    until: dateToInputValue(addDays(new Date(), 30)),
  }

  if (!recurrence || recurrence.length === 0) return { preset: 'none', custom: defaultCustom }

  const line = recurrence.find((r) => /^RRULE:/i.test(r))
  if (!line) return { preset: 'none', custom: defaultCustom }

  const parts: Record<string, string> = {}
  line
    .slice(6)
    .split(';')
    .forEach((p) => {
      const i = p.indexOf('=')
      if (i >= 0) parts[p.slice(0, i).toUpperCase()] = p.slice(i + 1)
    })

  const freq = (parts['FREQ'] ?? 'WEEKLY') as CustomRec['freq']
  const interval = parseInt(parts['INTERVAL'] ?? '1', 10)
  const byday = parts['BYDAY']
  const days: DayCode[] = byday ? (byday.split(',') as DayCode[]) : ['MO']
  const endType = parts['UNTIL'] ? 'until' : parts['COUNT'] ? 'count' : 'never'
  const count = parseInt(parts['COUNT'] ?? '5', 10)
  const until = parts['UNTIL']
    ? `${parts['UNTIL'].slice(0, 4)}-${parts['UNTIL'].slice(4, 6)}-${parts['UNTIL'].slice(6, 8)}`
    : dateToInputValue(addDays(new Date(), 30))

  const custom: CustomRec = { freq, interval, days, endType, count, until }

  if (freq === 'DAILY' && interval === 1 && !byday) return { preset: 'daily', custom }
  if (freq === 'WEEKLY' && interval === 1) return { preset: 'weekly', custom }
  if (freq === 'MONTHLY' && interval === 1) return { preset: 'monthly', custom }
  if (freq === 'YEARLY' && interval === 1) return { preset: 'yearly', custom }

  return { preset: 'custom', custom }
}

function buildRRule(preset: RecurrencePreset, custom: CustomRec, eventDate: Date): string[] {
  if (preset === 'none') return []

  const dowCode = DOW_TO_CODE[eventDate.getDay()]!

  switch (preset) {
    case 'daily':
      return ['RRULE:FREQ=DAILY']
    case 'weekly':
      return [`RRULE:FREQ=WEEKLY;BYDAY=${dowCode}`]
    case 'monthly':
      return [`RRULE:FREQ=MONTHLY;BYMONTHDAY=${eventDate.getDate()}`]
    case 'yearly':
      return ['RRULE:FREQ=YEARLY']
    case 'custom': {
      let rrule = `RRULE:FREQ=${custom.freq}`
      if (custom.interval > 1) rrule += `;INTERVAL=${custom.interval}`
      if (custom.freq === 'WEEKLY' && custom.days.length > 0)
        rrule += `;BYDAY=${custom.days.join(',')}`
      if (custom.endType === 'count') rrule += `;COUNT=${custom.count}`
      else if (custom.endType === 'until' && custom.until)
        rrule += `;UNTIL=${custom.until.replace(/-/g, '')}T235959Z`
      return [rrule]
    }
    default:
      return []
  }
}

// ── Location autocomplete via Photon (Komoot/OpenStreetMap, CORS-friendly) ─────

interface PhotonFeature {
  properties: {
    osm_id: number
    name?: string
    street?: string
    housenumber?: string
    city?: string
    state?: string
    country?: string
    postcode?: string
  }
}

function buildPhotonLabel(p: PhotonFeature['properties']): string {
  const parts: string[] = []
  if (p.name) parts.push(p.name)
  if (p.street) parts.push(p.housenumber ? `${p.street} ${p.housenumber}` : p.street)
  if (p.city && p.city !== p.name) parts.push(p.city)
  if (p.state && p.state !== p.city) parts.push(p.state)
  if (p.country) parts.push(p.country)
  return parts.join(', ')
}

async function fetchLocationSuggestions(query: string): Promise<{ description: string; place_id: string }[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json() as { features: PhotonFeature[] }
  return data.features.map((f, i) => ({
    description: buildPhotonLabel(f.properties),
    place_id: String(f.properties.osm_id ?? i),
  })).filter((s) => s.description.length > 0)
}

// ── Time options ───────────────────────────────────────────────────────────────

const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  TIME_OPTIONS.push(`${pad(h)}:00`)
  TIME_OPTIONS.push(`${pad(h)}:30`)
}

// ── CustomSelect ───────────────────────────────────────────────────────────────

interface SelectOption {
  value: string
  label: string
  color?: string
}

function CustomSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder,
}: {
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const trigRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  const openDrop = () => {
    if (disabled || !trigRef.current) return
    const r = trigRef.current.getBoundingClientRect()
    setDropStyle({
      position: 'fixed',
      left: r.left,
      top: r.bottom + 4,
      minWidth: r.width,
      zIndex: 9999,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (
        !trigRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  return (
    <>
      <button
        ref={trigRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDrop())}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors',
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        )}
        style={{
          borderColor: 'var(--border-secondary)',
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          backgroundColor: 'var(--bg-primary)',
        }}
        onMouseEnter={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = '#283B56'
        }}
        onMouseLeave={(e) => {
          if (!disabled) e.currentTarget.style.borderColor = 'var(--border-secondary)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && (
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
          )}
          <span className="truncate">{selected?.label ?? placeholder ?? '—'}</span>
        </span>
        <ChevronDown size={12} className="shrink-0 ml-2" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              ...dropStyle,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              maxHeight: 220,
              overflowY: 'auto',
              padding: 4,
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-left"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor:
                    value === opt.value ? 'var(--bg-hover)' : 'transparent',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    value === opt.value ? 'var(--bg-hover)' : 'transparent')
                }
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {value === opt.value && <Check size={12} style={{ color: '#283B56' }} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

// ── CustomDatePicker ───────────────────────────────────────────────────────────

function CustomDatePicker({
  value,
  onChange,
  placeholder,
}: {
  value: string // YYYY-MM-DD
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const trigRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const parsed = value ? new Date(value + 'T00:00:00') : null

  const openDrop = () => {
    if (!trigRef.current) return
    const d = parsed ?? new Date()
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
    const r = trigRef.current.getBoundingClientRect()
    const popupH = 288
    const topBelow = r.bottom + 4
    const topAbove = r.top - popupH - 4
    const top = topBelow + popupH > window.innerHeight && topAbove > 0 ? topAbove : topBelow
    setDropStyle({
      position: 'fixed',
      left: Math.min(r.left, window.innerWidth - 272 - 8),
      top,
      width: 272,
      zIndex: 9999,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (
        !trigRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  const DOW_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

  // Monday-first: Mon=0 … Sun=6
  const firstDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let i = 1; i <= daysInMonth; i++) cells.push(i)

  const todayKey = dateToInputValue(new Date())

  const selectDay = (day: number) => {
    onChange(`${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`)
    setOpen(false)
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }

  const displayLabel = parsed
    ? format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es })
    : (placeholder ?? 'Seleccionar fecha')

  return (
    <>
      <button
        ref={trigRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDrop())}
        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors"
        style={{
          borderColor: open ? '#283B56' : 'var(--border-secondary)',
          color: parsed ? 'var(--text-primary)' : 'var(--text-muted)',
          backgroundColor: 'var(--bg-primary)',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = '#283B56' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = 'var(--border-secondary)' }}
      >
        <span>{displayLabel}</span>
        <ChevronDown
          size={12}
          className="shrink-0 ml-2 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              ...dropStyle,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              padding: 12,
              userSelect: 'none',
            }}
          >
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={prevMonth}
                className="rounded-md p-1 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronDown size={14} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {MONTH_NAMES_ES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="rounded-md p-1 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>

            {/* DOW headers */}
            <div className="grid grid-cols-7 mb-1">
              {DOW_LABELS.map((d) => (
                <div
                  key={d}
                  className="text-center text-xs py-0.5 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />
                const cellKey = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
                const isSelected = cellKey === value
                const isToday = cellKey === todayKey
                return (
                  <button
                    key={cellKey}
                    type="button"
                    onClick={() => selectDay(day)}
                    className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors"
                    style={{
                      backgroundColor: isSelected ? '#283B56' : 'transparent',
                      color: isSelected ? '#fff' : isToday ? '#EC1E2A' : 'var(--text-primary)',
                      fontWeight: isToday || isSelected ? 600 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

// ── CustomTimePicker ───────────────────────────────────────────────────────────

function CustomTimePicker({
  value,
  onChange,
}: {
  value: string // HH:MM
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const trigRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const openDrop = () => {
    if (!trigRef.current) return
    const r = trigRef.current.getBoundingClientRect()
    const maxH = 200
    const topBelow = r.bottom + 4
    const topAbove = r.top - maxH - 4
    const top = topBelow + maxH > window.innerHeight && topAbove > 0 ? topAbove : topBelow
    setDropStyle({
      position: 'fixed',
      left: r.left,
      top,
      width: Math.max(r.width, 96),
      zIndex: 9999,
    })
    setOpen(true)
  }

  // Scroll to selected option when dropdown opens
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      if (!dropRef.current) return
      const el = dropRef.current.querySelector('[data-selected="true"]') as HTMLElement | null
      if (el) el.scrollIntoView({ block: 'center' })
    }, 0)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (
        !trigRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  return (
    <>
      <button
        ref={trigRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openDrop())}
        className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-left transition-colors"
        style={{
          borderColor: open ? '#283B56' : 'var(--border-secondary)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-primary)',
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.borderColor = '#283B56' }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.borderColor = 'var(--border-secondary)' }}
      >
        <span>{value || '00:00'}</span>
        <ChevronDown
          size={12}
          className="shrink-0 ml-2 transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              ...dropStyle,
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              maxHeight: 200,
              overflowY: 'auto',
              padding: 4,
            }}
          >
            {TIME_OPTIONS.map((t) => (
              <button
                key={t}
                type="button"
                data-selected={t === value}
                className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm text-left"
                style={{
                  color: 'var(--text-primary)',
                  backgroundColor: t === value ? 'var(--bg-hover)' : 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    t === value ? 'var(--bg-hover)' : 'transparent')
                }
                onClick={() => {
                  onChange(t)
                  setOpen(false)
                }}
              >
                <span>{t}</span>
                {t === value && <Check size={12} style={{ color: '#283B56' }} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}

// ── Recurrence Section ─────────────────────────────────────────────────────────

function RecurrenceSection({
  preset,
  custom,
  eventDate,
  onPresetChange,
  onCustomChange,
}: {
  preset: RecurrencePreset
  custom: CustomRec
  eventDate: Date
  onPresetChange: (p: RecurrencePreset) => void
  onCustomChange: (c: CustomRec) => void
}) {
  const dayName = format(eventDate, 'EEEE', { locale: es })
  const dayNum = eventDate.getDate()
  const monthDay = format(eventDate, "d 'de' MMMM", { locale: es })

  const presetOptions: SelectOption[] = [
    { value: 'none', label: 'No se repite' },
    { value: 'daily', label: 'Cada día' },
    { value: 'weekly', label: `Cada semana el ${dayName}` },
    { value: 'monthly', label: `Cada mes el día ${dayNum}` },
    { value: 'yearly', label: `Cada año el ${monthDay}` },
    { value: 'custom', label: 'Personalizado…' },
  ]

  const freqOptions: SelectOption[] = [
    { value: 'DAILY', label: 'Días' },
    { value: 'WEEKLY', label: 'Semanas' },
    { value: 'MONTHLY', label: 'Meses' },
    { value: 'YEARLY', label: 'Años' },
  ]

  const endOptions: SelectOption[] = [
    { value: 'never', label: 'Nunca' },
    { value: 'count', label: 'Después de' },
    { value: 'until', label: 'El día' },
  ]

  const toggleDay = (day: DayCode) => {
    const next = custom.days.includes(day)
      ? custom.days.filter((d) => d !== day)
      : [...custom.days, day]
    onCustomChange({ ...custom, days: next.length === 0 ? [day] : next })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <RefreshCw size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <div className="flex-1">
          <CustomSelect
            value={preset}
            options={presetOptions}
            onChange={(v) => onPresetChange(v as RecurrencePreset)}
          />
        </div>
      </div>

      {preset === 'custom' && (
        <div
          className="ml-6 space-y-2.5 rounded-lg p-3"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-secondary)',
          }}
        >
          {/* Interval */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Repetir cada
            </span>
            <input
              type="number"
              min={1}
              max={99}
              value={custom.interval}
              onChange={(e) =>
                onCustomChange({
                  ...custom,
                  interval: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              className="w-14 rounded-md border bg-transparent px-2 py-1 text-xs text-center outline-none"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="flex-1">
              <CustomSelect
                value={custom.freq}
                options={freqOptions}
                onChange={(v) =>
                  onCustomChange({ ...custom, freq: v as CustomRec['freq'] })
                }
              />
            </div>
          </div>

          {/* Days of week (weekly only) */}
          {custom.freq === 'WEEKLY' && (
            <div className="flex gap-1">
              {ALL_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className="h-7 w-7 rounded-full text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: custom.days.includes(day)
                      ? '#283B56'
                      : 'var(--bg-hover)',
                    color: custom.days.includes(day) ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  {DAY_LABELS[day]}
                </button>
              ))}
            </div>
          )}

          {/* End condition */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Finaliza
            </span>
            <div className="w-32">
              <CustomSelect
                value={custom.endType}
                options={endOptions}
                onChange={(v) =>
                  onCustomChange({ ...custom, endType: v as CustomRec['endType'] })
                }
              />
            </div>
            {custom.endType === 'count' && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={custom.count}
                  onChange={(e) =>
                    onCustomChange({
                      ...custom,
                      count: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="w-14 rounded-md border bg-transparent px-2 py-1 text-xs text-center outline-none"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  veces
                </span>
              </div>
            )}
            {custom.endType === 'until' && (
              <div className="flex-1">
                <CustomDatePicker
                  value={custom.until}
                  onChange={(v) => onCustomChange({ ...custom, until: v })}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Reminders Section ──────────────────────────────────────────────────────────

const REMINDER_MINUTE_OPTIONS: SelectOption[] = [
  { value: '0', label: 'A la hora del evento' },
  { value: '10', label: '10 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' },
  { value: '120', label: '2 horas antes' },
  { value: '1440', label: '1 día antes' },
  { value: '2880', label: '2 días antes' },
]

const REMINDER_METHOD_OPTIONS: SelectOption[] = [
  { value: 'popup', label: 'Notificación' },
  { value: 'email', label: 'Correo' },
]

function RemindersSection({
  reminders,
  onChange,
}: {
  reminders: CalendarEventReminder[]
  onChange: (r: CalendarEventReminder[]) => void
}) {
  const addReminder = () => {
    onChange([...reminders, { method: 'popup', minutes: 10 }])
  }

  const removeReminder = (idx: number) => {
    onChange(reminders.filter((_, i) => i !== idx))
  }

  const updateReminder = (idx: number, patch: Partial<CalendarEventReminder>) => {
    onChange(
      reminders.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <Bell size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Recordatorios
        </span>
        <button
          type="button"
          onClick={addReminder}
          className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
          style={{ color: '#283B56' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={11} />
          Agregar
        </button>
      </div>

      {reminders.length === 0 && (
        <div
          className="ml-6 flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <BellOff size={11} />
          Sin recordatorios personalizados (usa los predeterminados del calendario)
        </div>
      )}

      {reminders.map((reminder, idx) => (
        <div key={idx} className="ml-6 flex items-center gap-2">
          <div className="w-32">
            <CustomSelect
              value={reminder.method}
              options={REMINDER_METHOD_OPTIONS}
              onChange={(v) => updateReminder(idx, { method: v as 'popup' | 'email' })}
            />
          </div>
          <div className="flex-1">
            <CustomSelect
              value={String(reminder.minutes)}
              options={REMINDER_MINUTE_OPTIONS}
              onChange={(v) => updateReminder(idx, { minutes: parseInt(v, 10) })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeReminder(idx)}
            className="shrink-0 rounded-md p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface CalendarEventEditorProps {
  event?: CalendarEvent
  defaultDate?: Date
  defaultHour?: number
  defaultDurationMinutes?: number
  variant?: 'panel'
  onClose: () => void
}

export function CalendarEventEditor({
  event,
  defaultDate,
  defaultHour = 9,
  defaultDurationMinutes,
  variant,
  onClose,
}: CalendarEventEditorProps) {
  const isEditing = !!event
  const { createEvent, updateEvent, deleteEvent, moveEvent } = useCalendarEventMutations()
  const { data: integrations = [] } = useCalendarIntegrations()
  const googleIntegration = integrations.find((i) => i.provider === 'google' && i.is_active)
  const { data: calendarList = [] } = useGoogleCalendarList(googleIntegration)

  const { sidebarCollapsed } = useAppStore()
  const isMobile = useIsMobile()
  const [fullscreen, setFullscreen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const locationDropRef = useRef<HTMLDivElement>(null)

  // ── Location autocomplete ────────────────────────────────────────────────────
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [locationSuggestions, setLocationSuggestions] = useState<
    { description: string; place_id: string }[]
  >([])
  const [showLocationDrop, setShowLocationDrop] = useState(false)
  const [locationDropStyle, setLocationDropStyle] = useState<React.CSSProperties>({})

  // ── Form state ───────────────────────────────────────────────────────────────

  const initStart = event?.start ?? (() => {
    const d = defaultDate ? new Date(defaultDate) : new Date()
    d.setHours(defaultHour, 0, 0, 0)
    return d
  })()
  const initEnd = event?.end ?? (() => {
    const d = new Date(initStart.getTime() + (defaultDurationMinutes ?? 60) * 60_000)
    return d
  })()

  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [dateValue, setDateValue] = useState(dateToInputValue(initStart))
  const [startTime, setStartTime] = useState(timeToInputValue(initStart))
  const [endTime, setEndTime] = useState(timeToInputValue(initEnd))
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? false)
  const [calendarId, setCalendarId] = useState(
    event?.calendarId ?? calendarList.find((c) => c.primary)?.id ?? 'primary',
  )
  const originalCalendarId = useRef(event?.calendarId ?? 'primary')

  // Recurrence
  const { preset: initPreset, custom: initCustom } = parseRRuleToState(event?.recurrence)
  const [recurrencePreset, setRecurrencePreset] = useState<RecurrencePreset>(initPreset)
  const [customRec, setCustomRec] = useState<CustomRec>(initCustom)

  // Reminders
  const [reminders, setReminders] = useState<CalendarEventReminder[]>(event?.reminders ?? [])

  // ── Effects ──────────────────────────────────────────────────────────────────

  // Update calendarId when list loads (create mode)
  useEffect(() => {
    if (!isEditing && calendarList.length > 0 && calendarId === 'primary') {
      const primary = calendarList.find((c) => c.primary)
      if (primary) {
        setCalendarId(primary.id)
        originalCalendarId.current = primary.id
      }
    }
  }, [calendarList, isEditing, calendarId])

  // Focus title on mount
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)
    }
  }, [])

  // Outside click for location dropdown
  useEffect(() => {
    if (!showLocationDrop) return
    const close = (e: MouseEvent) => {
      if (
        !locationInputRef.current?.contains(e.target as Node) &&
        !locationDropRef.current?.contains(e.target as Node)
      ) {
        setShowLocationDrop(false)
      }
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [showLocationDrop])

  // ── Location autocomplete handler (Nominatim) ─────────────────────────────────

  const handleLocationChange = useCallback((val: string) => {
    setLocation(val)
    if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current)

    if (val.trim().length < 3) {
      setLocationSuggestions([])
      setShowLocationDrop(false)
      return
    }

    locationDebounceRef.current = setTimeout(async () => {
      const results = await fetchLocationSuggestions(val).catch(() => [])
      if (results.length === 0) {
        setLocationSuggestions([])
        setShowLocationDrop(false)
        return
      }
      setLocationSuggestions(results)
      if (locationInputRef.current) {
        const r = locationInputRef.current.getBoundingClientRect()
        setLocationDropStyle({
          position: 'fixed',
          left: r.left,
          top: r.bottom + 4,
          width: r.width,
          zIndex: 9999,
        })
      }
      setShowLocationDrop(true)
    }, 400)
  }, [])

  // ── Calendar options (solo escritura) ────────────────────────────────────────

  const calendarOptions: SelectOption[] = calendarList
    .filter((c) => c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader')
    .map((c) => ({
      value: c.id,
      label: c.summary,
      color: c.backgroundColor,
    }))

  const handleCalendarChange = useCallback((value: string) => {
    setCalendarId(value)
  }, [])

  const calendarChanged = isEditing && calendarId !== originalCalendarId.current

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      const trimmedTitle = title.trim()
      if (!trimmedTitle) {
        setError('El título es obligatorio.')
        titleRef.current?.focus()
        return
      }

      const parsedDate = new Date(dateValue + 'T00:00:00')
      if (isNaN(parsedDate.getTime())) {
        setError('Fecha inválida.')
        return
      }

      let startDate: Date
      let endDate: Date

      if (isAllDay) {
        startDate = new Date(parsedDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(parsedDate)
        endDate.setHours(23, 59, 59, 0)
      } else {
        const { h: sh, m: sm } = parseTime(startTime)
        const { h: eh, m: em } = parseTime(endTime)
        startDate = new Date(parsedDate)
        startDate.setHours(sh, sm, 0, 0)
        endDate = new Date(parsedDate)
        endDate.setHours(eh, em, 0, 0)
        if (endDate <= startDate) {
          endDate = new Date(startDate)
          endDate.setHours(startDate.getHours() + 1, startDate.getMinutes(), 0, 0)
        }
      }

      const recurrenceData = buildRRule(recurrencePreset, customRec, startDate)
      const remindersData = reminders

      try {
        if (isEditing && event) {
          const fromCalId = originalCalendarId.current

          await updateEvent.mutateAsync({
            eventId: event.id,
            calendarId: fromCalId,
            title: trimmedTitle,
            start: startDate,
            end: endDate,
            isAllDay,
            description: description || undefined,
            location: location || undefined,
            recurrence: event.recurringEventId ? undefined : recurrenceData,
            reminders: remindersData,
          })

          // If calendar changed, move the event
          if (calendarChanged) {
            await moveEvent.mutateAsync({
              eventId: event.id,
              fromCalendarId: fromCalId,
              toCalendarId: calendarId,
            })
          }
        } else {
          await createEvent.mutateAsync({
            calendarId,
            title: trimmedTitle,
            start: startDate,
            end: endDate,
            isAllDay,
            description: description || undefined,
            location: location || undefined,
            recurrence: recurrenceData,
            reminders: remindersData,
          })
        }
        onClose()
      } catch {
        setError('Error al guardar el evento. Intenta de nuevo.')
      }
    },
    [
      title,
      dateValue,
      isAllDay,
      startTime,
      endTime,
      recurrencePreset,
      customRec,
      reminders,
      description,
      location,
      calendarId,
      calendarChanged,
      isEditing,
      event,
      createEvent,
      updateEvent,
      moveEvent,
      onClose,
    ],
  )

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!event) return
    setError(null)
    try {
      await deleteEvent.mutateAsync({
        eventId: event.id,
        calendarId: event.calendarId ?? 'primary',
      })
      onClose()
    } catch {
      setError('Error al eliminar el evento.')
    }
  }

  const isLoading =
    createEvent.isPending || updateEvent.isPending || deleteEvent.isPending || moveEvent.isPending

  // ── Render ───────────────────────────────────────────────────────────────────

  const cardInner = (
    <>
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEditing ? 'Editar evento' : 'Nuevo evento'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFullscreen((f) => !f)}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Recurring event notice */}
          {isEditing && event?.recurringEventId && (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-secondary)',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Evento recurrente.
              </span>{' '}
              Solo se editará esta ocurrencia.
            </div>
          )}

          {/* Title */}
          <div>
            <input
              ref={titleRef}
              type="text"
              placeholder="Título del evento"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm font-medium outline-none transition-colors"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#283B56')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
            />
          </div>

          {/* Description */}
          <div className="flex items-start gap-2.5">
            <AlignLeft size={14} className="mt-2 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <textarea
              placeholder="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors"
              style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-primary)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#283B56')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-secondary)')}
            />
          </div>

          {/* Location with custom autocomplete */}
          <div className="flex items-center gap-2.5">
            <MapPin size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={locationInputRef}
              type="text"
              placeholder="Ubicación (opcional)"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-secondary)'
                setTimeout(() => setShowLocationDrop(false), 150)
              }}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors"
              style={{ borderColor: 'var(--border-secondary)', color: 'var(--text-primary)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#283B56')}
              autoComplete="off"
            />
          </div>

          {/* Location suggestions dropdown */}
          {showLocationDrop &&
            locationSuggestions.length > 0 &&
            createPortal(
              <div
                ref={locationDropRef}
                style={{
                  ...locationDropStyle,
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  maxHeight: 220,
                  overflowY: 'auto',
                  padding: 4,
                }}
              >
                {locationSuggestions.map((s) => (
                  <button
                    key={s.place_id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-left"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = 'transparent')
                    }
                    onMouseDown={(e) => {
                      e.preventDefault() // prevent input blur
                      setLocation(s.description)
                      setLocationSuggestions([])
                      setShowLocationDrop(false)
                    }}
                  >
                    <MapPin size={12} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                    <span className="truncate">{s.description}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}

          {/* Date + all-day toggle */}
          <div className="flex items-center gap-2.5">
            <Calendar size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div className="flex-1">
              <CustomDatePicker value={dateValue} onChange={setDateValue} />
            </div>
            <label
              className="flex items-center gap-1.5 cursor-pointer select-none text-xs whitespace-nowrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="rounded"
              />
              Todo el día
            </label>
          </div>

          {/* Time pickers */}
          {!isAllDay && (
            <div className="flex items-center gap-2.5">
              <Clock size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <CustomTimePicker value={startTime} onChange={setStartTime} />
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                  –
                </span>
                <div className="flex-1">
                  <CustomTimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
            </div>
          )}

          {/* Recurrence (hidden for recurring instances) */}
          {!event?.recurringEventId && (
            <RecurrenceSection
              preset={recurrencePreset}
              custom={customRec}
              eventDate={new Date(dateValue + 'T00:00:00')}
              onPresetChange={setRecurrencePreset}
              onCustomChange={setCustomRec}
            />
          )}

          {/* Reminders */}
          <RemindersSection reminders={reminders} onChange={setReminders} />

          {/* Calendar selector */}
          {calendarOptions.length > 1 && (
            <div className="flex items-center gap-2.5">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    calendarOptions.find((c) => c.value === calendarId)?.color ?? '#4285F4',
                }}
              />
              <div className="flex-1">
                <CustomSelect
                  value={calendarId}
                  options={calendarOptions}
                  onChange={handleCalendarChange}
                />
              </div>
            </div>
          )}

          {/* Calendar move notice */}
          {calendarChanged && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              El evento se moverá al calendario seleccionado.
            </p>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs font-medium" style={{ color: '#EC1E2A' }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div
            className="flex items-center justify-between border-t pt-3"
            style={{ borderColor: 'var(--border-secondary)' }}
          >
            {/* Delete */}
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    ¿Confirmar?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ backgroundColor: '#EC1E2A', color: '#fff' }}
                  >
                    {deleteEvent.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      'Eliminar'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors"
                  style={{ color: '#EC1E2A' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EC1E2A18')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Trash2 size={13} />
                  Eliminar evento
                </button>
              )
            ) : (
              <div />
            )}

            {/* Cancel + Save */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || !title.trim()}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  (isLoading || !title.trim()) && 'opacity-60 cursor-not-allowed',
                )}
                style={{ backgroundColor: '#283B56', color: '#fff' }}
              >
                {(createEvent.isPending || updateEvent.isPending || moveEvent.isPending) && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                {isEditing ? 'Guardar cambios' : 'Crear evento'}
              </button>
            </div>
          </div>
        </form>
    </>
  )

  if (fullscreen || isMobile) {
    return (
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-40 overflow-y-auto left-0',
          !isMobile && (sidebarCollapsed ? 'md:left-16' : 'md:left-72'),
        )}
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-4 md:px-6 md:py-6">
          <div
            className="rounded-2xl shadow-sm"
            style={{ border: '1px solid var(--border-primary)' }}
          >
            {cardInner}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'panel') {
    return (
      <div
        className="fixed right-0 inset-y-0 z-40 w-[420px] overflow-y-auto border-l"
        style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
      >
        {cardInner}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {cardInner}
      </div>
    </div>
  )
}
