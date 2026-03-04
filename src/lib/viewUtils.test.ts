import { describe, it, expect } from 'vitest'
import { applyViewFilters, applyViewSort, groupTasks } from './viewUtils'
import type { Task, Label, Project } from './types'
import type { ViewOptions } from '@/stores/uiStore'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    project_id: 'p1',
    section_id: null,
    parent_id: null,
    title: 'Test task',
    description: null,
    priority: 4,
    due_date: null,
    due_datetime: null,
    has_time: false,
    duration_minutes: null,
    is_completed: false,
    completed_at: null,
    is_recurring: false,
    recurrence_rule: null,
    recurrence_from: 'due_date',
    sort_order: 0,
    depth: 0,
    collapsed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deadline: null,
    ...overrides,
  } as Task
}

const defaultOpts: ViewOptions = {
  viewStyle: 'list',
  showCompleted: false,
  showHabits: true,
  groupBy: 'none',
  sortBy: 'manual',
  filterPriority: null,
  filterLabelId: null,
  filterDueDate: 'all',
  calendarMode: 'month',
  upcomingDays: 30,
  showFutureRecurrences: false,
}

describe('applyViewFilters', () => {
  it('filters by priority', () => {
    const tasks = [makeTask({ priority: 1 }), makeTask({ priority: 2 }), makeTask({ priority: 1 })]
    const result = applyViewFilters(tasks, { ...defaultOpts, filterPriority: 1 })
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.priority === 1)).toBe(true)
  })

  it('filters by label', () => {
    const t1 = makeTask()
    const t2 = makeTask()
    const labelsMap = new Map<string, Label[]>([
      [
        t1.id,
        [
          {
            id: 'l1',
            name: 'Work',
            color: '#000',
            user_id: 'u1',
            is_favorite: false,
            sort_order: 0,
            created_at: '',
          },
        ],
      ],
    ])
    const result = applyViewFilters([t1, t2], { ...defaultOpts, filterLabelId: 'l1' }, labelsMap)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe(t1.id)
  })

  it('filters by due date = nodate', () => {
    const tasks = [makeTask({ due_date: '2026-03-04' }), makeTask({ due_date: null })]
    const result = applyViewFilters(tasks, { ...defaultOpts, filterDueDate: 'nodate' })
    expect(result).toHaveLength(1)
    expect(result[0]!.due_date).toBeNull()
  })

  it('returns all when no filters', () => {
    const tasks = [makeTask(), makeTask(), makeTask()]
    const result = applyViewFilters(tasks, defaultOpts)
    expect(result).toHaveLength(3)
  })
})

describe('applyViewSort', () => {
  it('sorts by priority', () => {
    const tasks = [makeTask({ priority: 3 }), makeTask({ priority: 1 }), makeTask({ priority: 2 })]
    const result = applyViewSort(tasks, { ...defaultOpts, sortBy: 'priority' })
    expect(result.map((t) => t.priority)).toEqual([1, 2, 3])
  })

  it('sorts by name', () => {
    const tasks = [
      makeTask({ title: 'Zebra' }),
      makeTask({ title: 'Alfa' }),
      makeTask({ title: 'Beta' }),
    ]
    const result = applyViewSort(tasks, { ...defaultOpts, sortBy: 'name' })
    expect(result.map((t) => t.title)).toEqual(['Alfa', 'Beta', 'Zebra'])
  })

  it('sorts by due_date with nulls last', () => {
    const tasks = [
      makeTask({ due_date: null }),
      makeTask({ due_date: '2026-03-10' }),
      makeTask({ due_date: '2026-03-01' }),
    ]
    const result = applyViewSort(tasks, { ...defaultOpts, sortBy: 'due_date' })
    expect(result.map((t) => t.due_date)).toEqual(['2026-03-01', '2026-03-10', null])
  })

  it('sorts by sort_order when manual', () => {
    const tasks = [
      makeTask({ sort_order: 3 }),
      makeTask({ sort_order: 1 }),
      makeTask({ sort_order: 2 }),
    ]
    const result = applyViewSort(tasks, defaultOpts)
    expect(result.map((t) => t.sort_order)).toEqual([1, 2, 3])
  })
})

describe('groupTasks', () => {
  it('groups by none returns single group', () => {
    const tasks = [makeTask(), makeTask()]
    const groups = groupTasks(tasks, 'none')
    expect(groups).toHaveLength(1)
    expect(groups[0]!.key).toBe('all')
    expect(groups[0]!.tasks).toHaveLength(2)
  })

  it('groups by priority', () => {
    const tasks = [makeTask({ priority: 1 }), makeTask({ priority: 1 }), makeTask({ priority: 3 })]
    const groups = groupTasks(tasks, 'priority')
    expect(groups).toHaveLength(2)
    expect(groups[0]!.label).toContain('Urgente')
    expect(groups[0]!.tasks).toHaveLength(2)
    expect(groups[1]!.label).toContain('Media')
  })

  it('groups by label', () => {
    const t1 = makeTask()
    const t2 = makeTask()
    const t3 = makeTask()
    const labelsMap = new Map<string, Label[]>([
      [
        t1.id,
        [
          {
            id: 'l1',
            name: 'Work',
            color: '#f00',
            user_id: 'u1',
            is_favorite: false,
            sort_order: 0,
            created_at: '',
          },
        ],
      ],
      [
        t2.id,
        [
          {
            id: 'l1',
            name: 'Work',
            color: '#f00',
            user_id: 'u1',
            is_favorite: false,
            sort_order: 0,
            created_at: '',
          },
        ],
      ],
    ])
    const groups = groupTasks([t1, t2, t3], 'label', labelsMap)
    expect(groups).toHaveLength(2)
    const workGroup = groups.find((g) => g.label === 'Work')
    expect(workGroup?.tasks).toHaveLength(2)
    const noneGroup = groups.find((g) => g.label === 'Sin etiqueta')
    expect(noneGroup?.tasks).toHaveLength(1)
  })

  it('groups by project', () => {
    const tasks = [
      makeTask({ project_id: 'p1' }),
      makeTask({ project_id: 'p2' }),
      makeTask({ project_id: 'p1' }),
    ]
    const projects: Project[] = [
      { id: 'p1', name: 'Project A', color: '#f00' } as Project,
      { id: 'p2', name: 'Project B', color: '#0f0' } as Project,
    ]
    const groups = groupTasks(tasks, 'project', undefined, projects)
    expect(groups).toHaveLength(2)
    const a = groups.find((g) => g.label === 'Project A')
    expect(a?.tasks).toHaveLength(2)
    const b = groups.find((g) => g.label === 'Project B')
    expect(b?.tasks).toHaveLength(1)
  })

  it('groups by project without project data uses fallback', () => {
    const tasks = [makeTask({ project_id: 'p1' })]
    const groups = groupTasks(tasks, 'project')
    expect(groups).toHaveLength(1)
    expect(groups[0]!.label).toBe('Sin proyecto')
  })
})
