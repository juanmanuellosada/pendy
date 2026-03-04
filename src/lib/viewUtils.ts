import type { Task, Label } from './types'
import type { ViewOptions } from '@/stores/uiStore'
import { isOverdue, parseLocalDate } from './utils'
import { startOfWeek, endOfWeek, isWithinInterval } from 'date-fns'

/** Aplica filtros de la ViewOptionsBar a una lista de tareas */
export function applyViewFilters(
  tasks: Task[],
  opts: ViewOptions,
  labelsMap?: Map<string, Label[]>,
): Task[] {
  let list = tasks

  // Priority filter
  if (opts.filterPriority !== null) {
    list = list.filter((t) => t.priority === opts.filterPriority)
  }

  // Label filter
  if (opts.filterLabelId !== null) {
    list = list.filter((t) => {
      const taskLabels = labelsMap?.get(t.id) ?? []
      return taskLabels.some((l) => l.id === opts.filterLabelId)
    })
  }

  // Due date filter
  if (opts.filterDueDate !== 'all') {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    list = list.filter((t) => {
      switch (opts.filterDueDate) {
        case 'today':
          return t.due_date === todayStr
        case 'overdue':
          return t.due_date ? isOverdue(t.due_date) : false
        case 'nodate':
          return !t.due_date
        case 'week': {
          if (!t.due_date) return false
          const weekStart = startOfWeek(today, { weekStartsOn: 1 })
          const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
          const d = parseLocalDate(t.due_date)
          return isWithinInterval(d, { start: weekStart, end: weekEnd })
        }
        default:
          return true
      }
    })
  }

  return list
}

/** Aplica el orden seleccionado a la lista de tareas */
export function applyViewSort(tasks: Task[], opts: ViewOptions): Task[] {
  const list = [...tasks]

  switch (opts.sortBy) {
    case 'due_date':
      return list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'priority':
      return list.sort((a, b) => a.priority - b.priority)
    case 'name':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'es'))
    default:
      return list.sort((a, b) => a.sort_order - b.sort_order)
  }
}

/** Agrupa tareas según opts.groupBy */
export function groupTasks(
  tasks: Task[],
  groupBy: ViewOptions['groupBy'],
  labelsMap?: Map<string, Label[]>,
): { key: string; label: string; color?: string; tasks: Task[] }[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'Todas', tasks }]
  }

  if (groupBy === 'priority') {
    const priorityLabels: Record<number, string> = {
      1: 'Urgente',
      2: 'Alta',
      3: 'Media',
      4: 'Baja',
    }
    const priorityColors: Record<number, string> = {
      1: '#EC1E2A',
      2: '#F59E0B',
      3: '#3B82F6',
      4: '#6B7280',
    }
    return [1, 2, 3, 4]
      .map((p) => ({
        key: String(p),
        label: `P${p} — ${priorityLabels[p]}`,
        color: priorityColors[p],
        tasks: tasks.filter((t) => t.priority === p),
      }))
      .filter((g) => g.tasks.length > 0)
  }

  if (groupBy === 'label') {
    const grouped: Record<string, { label: string; color: string; tasks: Task[] }> = {}
    const unlabeled: Task[] = []

    tasks.forEach((task) => {
      const taskLabels = labelsMap?.get(task.id) ?? []
      if (taskLabels.length === 0) {
        unlabeled.push(task)
      } else {
        taskLabels.forEach((l) => {
          if (!grouped[l.id]) {
            grouped[l.id] = { label: l.name, color: l.color, tasks: [] }
          }
          grouped[l.id]!.tasks.push(task)
        })
      }
    })

    const result: { key: string; label: string; color?: string; tasks: Task[] }[] = Object.entries(
      grouped,
    ).map(([key, { label, color, tasks: t }]) => ({
      key,
      label,
      color,
      tasks: t,
    }))

    if (unlabeled.length > 0) {
      result.push({ key: 'none', label: 'Sin etiqueta', tasks: unlabeled })
    }

    return result
  }

  return [{ key: 'all', label: 'Todas', tasks }]
}
