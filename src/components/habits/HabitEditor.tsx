import { useState } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import { useCreateHabit, useUpdateHabit } from '@/hooks/useHabits'
import { useAuth } from '@/hooks/useAuth'
import type { Habit } from '@/lib/types'

const PRESET_COLORS = [
  '#283B56', '#EC1E2A', '#22C55E', '#3B82F6',
  '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6',
  '#F97316', '#6B7280',
]

const DAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAY_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DURATION_PRESETS = [10, 15, 20, 30, 45, 60]

interface HabitEditorProps {
  open: boolean
  onClose: () => void
  habit?: Habit | null
}

interface FormState {
  name: string
  color: string
  icon: string
  duration_minutes: number
  recurrence_type: 'daily' | 'times_per_week' | 'specific_days'
  times_per_week: number
  specific_days: number[]
}

const DEFAULT_FORM: FormState = {
  name: '',
  color: '#283B56',
  icon: '',
  duration_minutes: 30,
  recurrence_type: 'daily',
  times_per_week: 3,
  specific_days: [],
}

export function HabitEditor({ open, onClose, habit }: HabitEditorProps) {
  const { user } = useAuth()
  const createHabit = useCreateHabit()
  const updateHabit = useUpdateHabit()

  const [form, setForm] = useState<FormState>(() =>
    habit
      ? {
          name: habit.name,
          color: habit.color,
          icon: habit.icon ?? '',
          duration_minutes: habit.duration_minutes ?? 30,
          recurrence_type: habit.recurrence_type,
          times_per_week: habit.times_per_week ?? 3,
          specific_days: habit.specific_days ?? [],
        }
      : DEFAULT_FORM,
  )

  const [customDuration, setCustomDuration] = useState('')
  const isPreset = DURATION_PRESETS.includes(form.duration_minutes)

  const [error, setError] = useState('')

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const toggleDay = (day: number) =>
    set(
      'specific_days',
      form.specific_days.includes(day)
        ? form.specific_days.filter((d) => d !== day)
        : [...form.specific_days, day].sort(),
    )

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (form.recurrence_type === 'specific_days' && form.specific_days.length === 0) {
      setError('Selecciona al menos un día')
      return
    }

    setError('')

    const payload = {
      user_id: user!.id,
      name: form.name.trim(),
      color: form.color,
      icon: form.icon.trim() || null,
      duration_minutes: form.duration_minutes,
      recurrence_type: form.recurrence_type,
      times_per_week: form.recurrence_type === 'times_per_week' ? form.times_per_week : null,
      specific_days: form.recurrence_type === 'specific_days' ? form.specific_days : [],
      scheduled_time: null,
      is_active: true,
      is_archived: false,
      sort_order: 0,
    }

    if (habit) {
      await updateHabit.mutateAsync({ id: habit.id, updates: payload })
    } else {
      await createHabit.mutateAsync(payload)
    }

    onClose()
  }

  if (!open) return null

  const isPending = createHabit.isPending || updateHabit.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {habit ? 'Editar hábito' : 'Nuevo hábito'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-5">
          {/* Nombre + Emoji */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={form.icon}
                onChange={(e) => set('icon', e.target.value)}
                placeholder="😀"
                maxLength={2}
                className="h-10 w-12 rounded-lg border text-center text-lg outline-none"
                style={{
                  borderColor: 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Nombre del hábito"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: error && !form.name ? '#EC1E2A' : 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Color
            </label>
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

          {/* Duración */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Duración
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
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
            {/* Custom duration input */}
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
                className="w-32 rounded-lg border px-2 py-1.5 text-sm outline-none"
                style={{
                  borderColor: !isPreset ? form.color : 'var(--border-primary)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>min (1–480)</span>
            </div>
          </div>

          {/* Recurrencia */}
          <div>
            <label className="mb-2 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Recurrencia
            </label>

            <div className="space-y-2">
              {[
                { value: 'daily', label: 'Todos los días' },
                { value: 'times_per_week', label: 'X veces por semana' },
                { value: 'specific_days', label: 'Días específicos' },
              ].map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
                  style={{ backgroundColor: form.recurrence_type === value ? 'var(--bg-active)' : 'var(--bg-secondary)' }}
                >
                  <input
                    type="radio"
                    name="recurrence_type"
                    value={value}
                    checked={form.recurrence_type === value}
                    onChange={() => set('recurrence_type', value as FormState['recurrence_type'])}
                    className="accent-current"
                    style={{ accentColor: form.color }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
                </label>
              ))}
            </div>

            {/* Times per week stepper */}
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

            {/* Specific days toggles */}
            {form.recurrence_type === 'specific_days' && (
              <div className="mt-3 flex gap-2">
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

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t px-5 py-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: form.color }}
          >
            {isPending ? 'Guardando...' : habit ? 'Guardar cambios' : 'Crear hábito'}
          </button>
        </div>
      </div>
    </div>
  )
}
