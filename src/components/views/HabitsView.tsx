import { useState } from 'react'
import { Plus, Repeat, Flame, Trophy, CheckCircle2, Pencil, Trash2, Archive } from 'lucide-react'
import { format, subDays, startOfWeek } from 'date-fns'
import { useHabits, useHabitCompletionsExtended, useToggleHabitCompletion, useDeleteHabit, useUpdateHabit } from '@/hooks/useHabits'
import { HabitEditor } from '@/components/habits/HabitEditor'
import { HabitCheckbox } from '@/components/habits/HabitCheckbox'
import { calculateStreak, getWeeklyProgress, getRecurrenceLabel, isCompletedOnDate, habitAppearsOnDate, getHabitDatesInRange } from '@/lib/habitUtils'
import { useUIStore } from '@/stores/uiStore'
import { stripHtmlTags, stripLabelTokensFromHtml } from '@/lib/utils'
import type { Habit, HabitCompletion } from '@/lib/types'

export function HabitsView() {
  const { data: habits = [], isLoading } = useHabits()
  const { data: completions = [] } = useHabitCompletionsExtended()
  const toggleCompletion = useToggleHabitCompletion()
  const deleteHabit = useDeleteHabit()
  const updateHabit = useUpdateHabit()
  const { showConfirmDialog } = useUIStore()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)

  const today = new Date()

  const activeHabits = habits.filter((h) => !h.is_archived)
  const todayHabits = activeHabits.filter((h) => habitAppearsOnDate(h, today))
  const completedToday = todayHabits.filter((h) => isCompletedOnDate(completions, h.id, today)).length
  const bestStreak = activeHabits.reduce((best, h) => {
    const s = calculateStreak(h, completions, today)
    return s.best > best ? s.best : best
  }, 0)

  const handleToggle = (habitId: string, date: Date) => {
    toggleCompletion.mutate({ habitId, date })
  }

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit)
    setEditorOpen(true)
  }

  const handleDelete = (habit: Habit) => {
    showConfirmDialog({
      title: `¿Eliminar "${stripHtmlTags(habit.name)}"?`,
      message: 'Se eliminarán también todas las marcaciones de este hábito. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await deleteHabit.mutateAsync(habit.id)
      },
    })
  }

  const handleArchive = (habit: Habit) => {
    updateHabit.mutate({ id: habit.id, updates: { is_archived: true } })
  }

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingHabit(null)
  }

  // Group habits by recurrence type
  const daily = activeHabits.filter((h) => h.recurrence_type === 'daily')
  const weekly = activeHabits.filter((h) => h.recurrence_type === 'times_per_week')
  const specific = activeHabits.filter((h) => h.recurrence_type === 'specific_days')

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold md:text-xl" style={{ color: 'var(--text-primary)' }}>
            Hábitos
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Seguimiento de tus rutinas
          </p>
        </div>
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#283B56' }}
        >
          <Plus size={15} />
          Nuevo hábito
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard
          icon={<Repeat size={18} style={{ color: '#283B56' }} />}
          label="Activos"
          value={activeHabits.length}
          bg="#283B5610"
        />
        <StatCard
          icon={<Trophy size={18} style={{ color: '#F59E0B' }} />}
          label="Mejor racha"
          value={`${bestStreak} d`}
          bg="#F59E0B10"
        />
        <StatCard
          icon={<CheckCircle2 size={18} style={{ color: '#22C55E' }} />}
          label="Hoy"
          value={`${completedToday}/${todayHabits.length}`}
          bg="#22C55E10"
        />
      </div>

      {activeHabits.length === 0 ? (
        <div className="py-16 text-center">
          <Repeat size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Sin hábitos todavía
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Crea tu primer hábito para empezar a construir rutinas
          </p>
          <button
            onClick={() => setEditorOpen(true)}
            className="mt-4 flex items-center gap-2 mx-auto rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={15} />
            Crear primer hábito
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {daily.length > 0 && (
            <HabitGroup
              title="Diarios"
              habits={daily}
              completions={completions}
              today={today}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              isPending={toggleCompletion.isPending}
            />
          )}
          {weekly.length > 0 && (
            <HabitGroup
              title="Por semana"
              habits={weekly}
              completions={completions}
              today={today}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              isPending={toggleCompletion.isPending}
            />
          )}
          {specific.length > 0 && (
            <HabitGroup
              title="Días específicos"
              habits={specific}
              completions={completions}
              today={today}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
              isPending={toggleCompletion.isPending}
            />
          )}
        </div>
      )}

      <HabitEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        habit={editingHabit}
      />
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  bg: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl p-3 text-center"
      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
    >
      <div className="rounded-lg p-2" style={{ backgroundColor: bg }}>
        {icon}
      </div>
      <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

// ── HabitGroup ─────────────────────────────────────────────────────────────────

interface HabitGroupProps {
  title: string
  habits: Habit[]
  completions: HabitCompletion[]
  today: Date
  onToggle: (id: string, date: Date) => void
  onEdit: (h: Habit) => void
  onDelete: (h: Habit) => void
  onArchive: (h: Habit) => void
  isPending: boolean
}

function HabitGroup({
  title,
  habits,
  completions,
  today,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  isPending,
}: HabitGroupProps) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {title}
      </h2>
      <div
        className="divide-y overflow-hidden rounded-xl"
        style={{
          border: '1px solid var(--border-primary)',
          borderColor: 'var(--border-secondary)',
        }}
      >
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            completions={completions}
            today={today}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            isPending={isPending}
          />
        ))}
      </div>
    </div>
  )
}

// ── HabitRow ───────────────────────────────────────────────────────────────────

function HabitRow({
  habit,
  completions,
  today,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  isPending,
}: {
  habit: Habit
  completions: HabitCompletion[]
  today: Date
  onToggle: (id: string, date: Date) => void
  onEdit: (h: Habit) => void
  onDelete: (h: Habit) => void
  onArchive: (h: Habit) => void
  isPending: boolean
}) {
  const streak = calculateStreak(habit, completions, today)
  const recLabel = getRecurrenceLabel(habit)
  const completedToday = isCompletedOnDate(completions, habit.id, today)
  const appearsToday = habitAppearsOnDate(habit, today)

  // Mini heatmap: last 30 days
  const from = subDays(today, 29)
  const heatmapDates = getHabitDatesInRange(habit, from, today)

  const weeklyProgress = habit.recurrence_type === 'times_per_week'
    ? getWeeklyProgress(completions, habit.id, startOfWeek(today, { weekStartsOn: 1 }))
    : null

  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3 transition-colors"
      style={{
        borderLeft: `3px solid ${habit.color}`,
        backgroundColor: 'var(--bg-primary)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-primary)')}
    >
      {/* Checkbox (solo si aparece hoy) */}
      {appearsToday ? (
        <HabitCheckbox
          completed={completedToday}
          color={habit.color}
          onChange={() => onToggle(habit.id, today)}
          disabled={isPending}
        />
      ) : (
        <div className="h-[22px] w-[22px] flex-shrink-0" />
      )}

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5">
          {habit.icon && <span className="text-sm leading-none">{habit.icon}</span>}
          <span
            className="text-sm font-medium truncate min-w-0"
            style={{ color: 'var(--text-primary)' }}
            dangerouslySetInnerHTML={{
              __html: stripLabelTokensFromHtml(habit.name).replace(/^<p>(.*)<\/p>$/, '$1'),
            }}
          />
        </div>
        <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {recLabel}
          {habit.scheduled_time && ` · ${habit.scheduled_time.slice(0, 5)}`}
          {` · ${habit.duration_minutes} min`}
        </span>
      </div>

      {/* Mini heatmap */}
      <div className="hidden md:flex items-center gap-0.5">
        {heatmapDates.slice(-14).map((d) => {
          const done = isCompletedOnDate(completions, habit.id, d)
          return (
            <div
              key={d.toISOString()}
              className="h-3 w-3 rounded-sm"
              style={{ backgroundColor: done ? habit.color : 'var(--bg-secondary)' }}
              title={format(d, 'dd/MM')}
            />
          )
        })}
      </div>

      {/* Streak / weekly badges */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {weeklyProgress ? (
          <div
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: weeklyProgress.done >= (habit.times_per_week ?? 1) ? `${habit.color}20` : 'var(--bg-secondary)',
              color: weeklyProgress.done >= (habit.times_per_week ?? 1) ? habit.color : 'var(--text-secondary)',
            }}
          >
            {weeklyProgress.done}/{habit.times_per_week} sem.
          </div>
        ) : streak.current > 0 ? (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: '#F59E0B15', color: '#F59E0B' }}
          >
            <Flame size={11} />
            {streak.current}
          </div>
        ) : null}
        {streak.best > 1 && (
          <div
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{ color: 'var(--text-muted)' }}
            title={`Mejor racha: ${streak.best} días`}
          >
            <Trophy size={10} />
            {streak.best}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={() => onEdit(habit)}
          className="rounded-lg p-1.5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-active)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onArchive(habit)}
          className="rounded-lg p-1.5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-active)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          title="Archivar"
        >
          <Archive size={14} />
        </button>
        <button
          onClick={() => onDelete(habit)}
          className="rounded-lg p-1.5 transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EC1E2A15'
            e.currentTarget.style.color = '#EC1E2A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
