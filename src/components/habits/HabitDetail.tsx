import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Clock, Repeat, Trash2, Flame, Minus, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAppStore } from '@/stores/appStore'
import { useUIStore } from '@/stores/uiStore'
import {
  useHabits,
  useHabitCompletions,
  useHabitSchedules,
  useToggleHabitCompletion,
  useUpsertHabitSchedule,
  useSetHabitDefaultTime,
  useDeleteHabit,
  useUpdateHabit,
} from '@/hooks/useHabits'
import { HabitCheckbox } from './HabitCheckbox'
import {
  getScheduledTimeForDate,
  getRecurrenceLabel,
  calculateStreak,
  isCompletedOnDate,
} from '@/lib/habitUtils'
import { stripHtmlTags } from '@/lib/utils'
import { TitleEditor } from '@/components/tasks/TitleEditor'
import type { Habit } from '@/lib/types'

const PRESET_COLORS = [
  '#283B56', '#EC1E2A', '#22C55E', '#3B82F6',
  '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F97316', '#6B7280',
]

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAY_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DURATION_PRESETS = [10, 15, 20, 30, 45, 60]

interface FormState {
  name: string
  icon: string
  color: string
  duration_minutes: number
  recurrence_type: 'daily' | 'times_per_week' | 'specific_days'
  times_per_week: number
  specific_days: number[]
}

function formFromHabit(h: Habit): FormState {
  return {
    name: h.name,
    icon: h.icon ?? '',
    color: h.color,
    duration_minutes: h.duration_minutes ?? 30,
    recurrence_type: h.recurrence_type,
    times_per_week: h.times_per_week ?? 3,
    specific_days: h.specific_days ?? [],
  }
}

export function HabitDetail() {
  const { habitDetailOpen, selectedHabitId, selectedHabitDate } = useAppStore()
  if (!habitDetailOpen || !selectedHabitId || !selectedHabitDate) return null
  return <HabitDetailInner habitId={selectedHabitId} dateStr={selectedHabitDate} />
}

function HabitDetailInner({ habitId, dateStr }: { habitId: string; dateStr: string }) {
  const { setSelectedHabit, detailPanelWidth, setDetailPanelWidth } = useAppStore()
  const { showConfirmDialog } = useUIStore()

  const { data: habits = [] } = useHabits()
  const { data: completions = [] } = useHabitCompletions(dateStr, dateStr)
  const { data: schedules = [] } = useHabitSchedules(dateStr, dateStr)
  const toggleCompletion = useToggleHabitCompletion()
  const upsertSchedule = useUpsertHabitSchedule()
  const setDefaultTime = useSetHabitDefaultTime()
  const deleteHabit = useDeleteHabit()
  const updateHabit = useUpdateHabit()

  const habit = habits.find((h) => h.id === habitId)
  const date = new Date(dateStr + 'T00:00:00')
  const scheduledTime = habit ? getScheduledTimeForDate(habit, schedules, date) : null

  // Form state — all edits live here until "Guardar"
  const [form, setForm] = useState<FormState>({
    name: '', icon: '', color: '#283B56', duration_minutes: 30,
    recurrence_type: 'daily', times_per_week: 3, specific_days: [],
  })
  const [customDuration, setCustomDuration] = useState('')
  const [localTime, setLocalTime] = useState(scheduledTime ? scheduledTime.slice(0, 5) : '')

  // Sync form the first time habit data becomes available for this habitId.
  // Using a ref so the effect doesn't re-trigger on every re-render after the user
  // starts editing (we don't want to overwrite their in-progress edits on query refetches).
  const initializedFor = useRef<string | null>(null)
  useEffect(() => {
    if (habit && initializedFor.current !== habit.id) {
      initializedFor.current = habit.id
      setForm(formFromHabit(habit))
      setCustomDuration('')
    }
  }, [habit])

  useEffect(() => {
    setLocalTime(scheduledTime ? scheduledTime.slice(0, 5) : '')
  }, [scheduledTime, habitId, dateStr])

  // Resize panel
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      startX.current = e.clientX
      startWidth.current = detailPanelWidth
      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        setDetailPanelWidth(startWidth.current + (startX.current - ev.clientX))
      }
      const onUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [detailPanelWidth, setDetailPanelWidth],
  )

  if (!habit) return null

  const close = () => setSelectedHabit(null)
  const completed = isCompletedOnDate(completions, habit.id, date)
  const streak = calculateStreak(habit, completions, date)
  const dateLabel = format(date, "EEEE d 'de' MMMM", { locale: es })
  const isPresetDuration = DURATION_PRESETS.includes(form.duration_minutes)
  const hasOverride = schedules.some((s) => s.habit_id === habit.id && s.scheduled_date === dateStr)
  const isUsingDefault = !hasOverride && !!habit.scheduled_time

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleDay = (day: number) => {
    const next = form.specific_days.includes(day)
      ? form.specific_days.filter((d) => d !== day)
      : [...form.specific_days, day].sort()
    set('specific_days', next)
  }

  // Computed end time (uses form.duration_minutes for live preview)
  const endTime = localTime
    ? (() => {
        const [h, m] = localTime.split(':').map(Number)
        const totalMin = (h ?? 0) * 60 + (m ?? 0) + form.duration_minutes
        const eh = Math.floor(totalMin / 60) % 24
        const em = totalMin % 60
        return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
      })()
    : null

  const handleSave = () => {
    if (!stripHtmlTags(form.name).trim()) return
    updateHabit.mutate({
      id: habit.id,
      updates: {
        name: form.name,
        icon: form.icon.trim() || null,
        color: form.color,
        duration_minutes: form.duration_minutes,
        recurrence_type: form.recurrence_type,
        times_per_week: form.recurrence_type === 'times_per_week' ? form.times_per_week : null,
        specific_days: form.recurrence_type === 'specific_days' ? form.specific_days : [],
      },
    })
  }

  const handleSaveForDay = () => {
    if (!localTime) return
    upsertSchedule.mutate({ habitId: habit.id, date: dateStr, time: localTime + ':00' })
  }

  const handleSaveAsDefault = () => {
    if (!localTime) return
    setDefaultTime.mutate({ habitId: habit.id, time: localTime + ':00' })
  }

  const handleDelete = () => {
    showConfirmDialog({
      title: `¿Eliminar "${stripHtmlTags(habit.name)}"?`,
      message: 'Se eliminarán también todas las marcaciones de este hábito. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await deleteHabit.mutateAsync(habit.id)
        close()
      },
    })
  }

  return (
    <>
      {/* Backdrop mobile */}
      <div className="fixed inset-0 z-30 bg-black/20 md:hidden" onClick={close} />

      {/* Panel */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full flex-col border-l shadow-xl md:relative md:z-0 md:shadow-none"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          width: `${detailPanelWidth}px`,
          minWidth: '320px',
          maxWidth: '700px',
        }}
      >
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 z-10 hidden h-full w-1 cursor-col-resize md:block"
          style={{ marginLeft: '-2px' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--border-primary)')}
          onMouseLeave={(e) => {
            if (!isDragging.current) e.currentTarget.style.backgroundColor = 'transparent'
          }}
        />

        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Hábito
          </span>
          <button
            onClick={close}
            className="rounded p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Colored accent bar */}
        <div className="h-1 flex-shrink-0" style={{ backgroundColor: form.color }} />

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">

          {/* ── Completion + name ── */}
          <div className="flex items-start gap-3">
            <div className="mt-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <HabitCheckbox
                completed={completed}
                color={form.color}
                onChange={() => toggleCompletion.mutate({ habitId: habit.id, date })}
                disabled={toggleCompletion.isPending}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => set('icon', e.target.value)}
                  placeholder="😀"
                  maxLength={2}
                  className="h-8 w-9 flex-shrink-0 rounded border text-center text-base outline-none"
                  style={{
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div
                  className="flex-1 rounded border px-2 py-1 transition-colors"
                  style={{
                    borderColor: 'transparent',
                    backgroundColor: 'transparent',
                    opacity: completed ? 0.7 : 1,
                  }}
                  onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = form.color)}
                  onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'transparent')}
                >
                  <TitleEditor
                    content={form.name}
                    onChange={(html) => set('name', html)}
                    onSubmit={handleSave}
                    placeholder="Nombre del hábito"
                    textClassName="text-sm font-semibold leading-normal"
                  />
                </div>
              </div>
              <p className="mt-1 text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>
                {dateLabel}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: completed ? '#22C55E' : 'var(--text-muted)' }}
                />
                <span className="text-xs font-medium" style={{ color: completed ? '#22C55E' : 'var(--text-muted)' }}>
                  {completed ? 'Completado' : 'Pendiente'}
                </span>
                {streak.current > 0 && (
                  <span className="ml-1 flex items-center gap-1 text-xs font-medium" style={{ color: '#F59E0B' }}>
                    <Flame size={11} />
                    {streak.current}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }} />

          {/* ── Horario ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Horario
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Inicio
                </label>
                <input
                  type="time"
                  value={localTime}
                  onChange={(e) => setLocalTime(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors"
                  style={{
                    borderColor: localTime ? form.color : 'var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              {endTime && (
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Fin (estimado)
                  </label>
                  <div
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    style={{
                      borderColor: 'var(--border-secondary)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {endTime}
                  </div>
                </div>
              )}
            </div>

            {isUsingDefault && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Usando hora predeterminada del hábito
              </p>
            )}
            {!localTime && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                Sin horario asignado
              </p>
            )}

            {localTime && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleSaveForDay}
                  disabled={upsertSchedule.isPending}
                  className="flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60"
                  style={{
                    borderColor: form.color,
                    color: form.color,
                    backgroundColor: `${form.color}12`,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${form.color}25`)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${form.color}12`)}
                >
                  Solo este día
                </button>
                <button
                  onClick={handleSaveAsDefault}
                  disabled={setDefaultTime.isPending}
                  className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition-opacity disabled:opacity-60"
                  style={{ backgroundColor: form.color }}
                >
                  Todos los días
                </button>
              </div>
            )}
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }} />

          {/* ── Color ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Color
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: form.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }} />

          {/* ── Duración ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Duración
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((min) => (
                <button
                  key={min}
                  onClick={() => { set('duration_minutes', min); setCustomDuration('') }}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: form.duration_minutes === min ? form.color : 'var(--border-primary)',
                    backgroundColor: form.duration_minutes === min ? `${form.color}18` : 'var(--bg-secondary)',
                    color: form.duration_minutes === min ? form.color : 'var(--text-secondary)',
                  }}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={480}
                value={customDuration}
                onChange={(e) => {
                  const v = e.target.value
                  setCustomDuration(v)
                  const n = parseInt(v, 10)
                  if (!isNaN(n) && n >= 1 && n <= 480) set('duration_minutes', n)
                }}
                placeholder="Personalizado"
                className="w-28 rounded-lg border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: !isPresetDuration ? form.color : 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min</span>
            </div>
          </div>

          <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }} />

          {/* ── Recurrencia ── */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Recurrencia
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { value: 'daily', label: 'Todos los días' },
                  { value: 'times_per_week', label: 'X veces por semana' },
                  { value: 'specific_days', label: 'Días específicos' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
                  style={{
                    backgroundColor:
                      form.recurrence_type === value ? 'var(--bg-active)' : 'var(--bg-secondary)',
                  }}
                >
                  <input
                    type="radio"
                    name={`habit-recurrence-${habitId}`}
                    checked={form.recurrence_type === value}
                    onChange={() => set('recurrence_type', value)}
                    style={{ accentColor: form.color }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>

            {form.recurrence_type === 'times_per_week' && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => set('times_per_week', Math.max(1, form.times_per_week - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {form.times_per_week}
                </span>
                <button
                  onClick={() => set('times_per_week', Math.min(7, form.times_per_week + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  <Plus size={14} />
                </button>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {form.times_per_week === 1 ? 'vez' : 'veces'} por semana
                </span>
              </div>
            )}

            {form.recurrence_type === 'specific_days' && (
              <div className="mt-3 flex flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: form.specific_days.includes(day) ? form.color : 'var(--bg-secondary)',
                      color: form.specific_days.includes(day) ? '#FFFFFF' : 'var(--text-secondary)',
                      border: `1px solid ${form.specific_days.includes(day) ? form.color : 'var(--border-primary)'}`,
                    }}
                    title={DAY_FULL[day]}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stats summary */}
          <div
            className="flex flex-wrap items-center gap-4 rounded-lg px-3 py-2.5"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="flex items-center gap-2">
              <Repeat size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {getRecurrenceLabel({ ...habit, ...form })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {form.duration_minutes} min
              </span>
            </div>
            {streak.current > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame size={13} style={{ color: '#F59E0B' }} />
                <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                  {streak.current} {streak.current === 1 ? 'día' : 'días'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-2 border-t p-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={handleSave}
            disabled={updateHabit.isPending || !stripHtmlTags(form.name).trim()}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: form.color }}
          >
            {updateHabit.isPending ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: '#EC1E2A', backgroundColor: '#EC1E2A10' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EC1E2A20')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#EC1E2A10')}
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </aside>
    </>
  )
}
