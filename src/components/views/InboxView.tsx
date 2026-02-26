import { Plus, Inbox } from 'lucide-react'
import { useInboxTasks } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useCreateSection } from '@/hooks/useSections'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskGroup } from '@/components/tasks/TaskGroup'
import { ViewOptionsBar } from './ViewOptionsBar'
import { BoardView } from './BoardView'
import { CalendarView } from './CalendarView'
import { SectionEditor } from '@/components/projects/SectionEditor'
import { useInboxProject } from '@/hooks/useProjects'
import { useUIStore } from '@/stores/uiStore'
import { applyViewFilters, applyViewSort, groupTasks } from '@/lib/viewUtils'
import { useState, useMemo, useEffect } from 'react'
import type { Task, Section } from '@/lib/types'

const VIEW_ID = 'inbox'

export function InboxView() {
  const { data: tasks = [], isLoading } = useInboxTasks()
  const { data: labelsMap } = useAllTaskLabelsMap()
  const { data: inboxProject } = useInboxProject()
  const createSection = useCreateSection()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null)
  const { getViewOptions } = useUIStore()
  const opts = getViewOptions(VIEW_ID)

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
    setDefaultSectionId(null)
  }

  const handleAddTaskFromBoard = (sectionId?: string | null) => {
    if (sectionId === undefined) {
      // "Add section" button clicked
      setSectionEditorOpen(true)
      return
    }
    setDefaultSectionId(sectionId)
    setEditorOpen(true)
  }

  const handleAddTask = (dateStr?: string) => {
    setEditorOpen(true)
  }

  const handleSaveSection = (name: string) => {
    if (inboxProject) {
      createSection.mutate({ project_id: inboxProject.id, name })
    }
  }

  // S keyboard shortcut to add section
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setSectionEditorOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const visibleTasks = useMemo(() => {
    let list = tasks
    if (!opts.showCompleted) list = list.filter((t) => !t.is_completed)
    list = applyViewFilters(list, opts, labelsMap)
    list = applyViewSort(list, opts)
    return list
  }, [tasks, opts, labelsMap])

  const groups = useMemo(
    () => groupTasks(visibleTasks, opts.groupBy, labelsMap),
    [visibleTasks, opts.groupBy, labelsMap],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        ))}
      </div>
    )
  }

  const renderContent = () => {
    // Panel / Board view
    if (opts.viewStyle === 'panel' && inboxProject) {
      return (
        <BoardView
          projectId={inboxProject.id}
          tasks={visibleTasks}
          onAddTask={handleAddTaskFromBoard}
          onEditSection={(section) => {
            setEditingSection(section)
            setSectionEditorOpen(true)
          }}
        />
      )
    }

    // Calendar view
    if (opts.viewStyle === 'calendar') {
      return (
        <CalendarView
          calendarMode={opts.calendarMode}
          onAddTask={handleAddTask}
        />
      )
    }

    // List view (default)
    if (visibleTasks.length === 0) {
      return (
        <div className="py-12 text-center">
          <Inbox size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
          <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Tu bandeja de entrada está vacía. ¡Bien hecho!
          </p>
        </div>
      )
    }

    if (opts.groupBy !== 'none') {
      return (
        <div>
          {groups.map((group) => (
            <TaskGroup
              key={group.key}
              label={group.label}
              color={group.color}
              tasks={group.tasks}
              labelsMap={labelsMap}
            />
          ))}
        </div>
      )
    }

    return (
      <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
        {visibleTasks.map((task) => (
          <TaskItem key={task.id} task={task} labels={labelsMap?.get(task.id)} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Entrada
        </h1>
        <div className="flex items-center gap-2">
          <ViewOptionsBar viewId={VIEW_ID} />
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={16} />
            Agregar tarea
          </button>
        </div>
      </div>

      {renderContent()}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultProjectId={inboxProject?.id}
      />

      <SectionEditor
        open={sectionEditorOpen}
        onClose={() => {
          setSectionEditorOpen(false)
          setEditingSection(null)
        }}
        onSave={handleSaveSection}
        section={editingSection}
      />
    </div>
  )
}
