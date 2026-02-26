import { useState, useRef, useEffect, useMemo } from 'react'
import { format, subMinutes, subHours, subDays, subWeeks } from 'date-fns'
import { X, ChevronDown, Clock, Bell, Info, HelpCircle } from 'lucide-react'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'

export interface ReminderConfig {
  type: 'datetime' | 'before'
  /** For 'datetime': ISO string. For 'before': minutes before due datetime. */
  value: string | number
  label: string
}

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
}

export function ReminderPicker({
  reminders,
  onAdd,
  onRemove,
  hasDateTime,
  dueDate: _dueDate,
  dueTime: _dueTime,
}: ReminderPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'datetime' | 'before'>('before')
  const [timeInput, setTimeInput] = useState('09:00')
  const [beforeDropdownOpen, setBeforeDropdownOpen] = useState(false)
  const [selectedBeforeMinutes, setSelectedBeforeMinutes] = useState(30)
  const containerRef = useRef<HTMLDivElement>(null)
  const floatingStyle = useFloatingPosition(containerRef, open, 320) // w-80 = 320px

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setBeforeDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedBeforeLabel = useMemo(
    () => BEFORE_OPTIONS.find((o) => o.minutes === selectedBeforeMinutes)?.label ?? '30 mins antes',
    [selectedBeforeMinutes],
  )

  const handleAddDatetime = () => {
    if (!timeInput) return
    // Build a datetime from today's date + the selected time
    const today = format(new Date(), 'yyyy-MM-dd')
    const datetime = `${today}T${timeInput}:00`
    onAdd({
      type: 'datetime',
      value: datetime,
      label: timeInput,
    })
    setOpen(false)
  }

  const handleAddBefore = () => {
    const option = BEFORE_OPTIONS.find((o) => o.minutes === selectedBeforeMinutes)
    if (!option) return
    onAdd({
      type: 'before',
      value: option.minutes,
      label: option.label,
    })
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
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
      </button>

      {open && (
        <div
          className="w-80 rounded-xl border shadow-xl"
          style={{
            ...floatingStyle,
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-lg)',
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
                {/* Time input */}
                <div
                  className="mb-3 flex items-center gap-2 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                >
                  <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="time"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>

                <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Establece una notificación de una hora (&quot;9am&quot;) o fecha y hora
                  (&quot;lun 18:00&quot; o &quot;cada martes 7pm&quot;) específicas.
                </p>

                <div className="flex justify-end">
                  <button
                    onClick={handleAddDatetime}
                    className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: '#EC1E2A' }}
                  >
                    Añadir recordatorio
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
