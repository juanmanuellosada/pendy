import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Plus,
  MoreHorizontal,
  Archive,
  Trash2,
  Pencil,
  Star,
  LayoutList,
  GripVertical,
  ChevronDown,
  ChevronRight,
  ListChecks,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectTasks, useReorderTasks, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { useArchiveProject, useDeleteProject, useToggleProjectFavorite } from '@/hooks/useProjects'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import {
  useProjectSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
} from '@/hooks/useSections'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskGroup } from '@/components/tasks/TaskGroup'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { ProjectEditor } from './ProjectEditor'
import { SectionEditor } from './SectionEditor'
import { ViewOptionsBar } from '@/components/views/ViewOptionsBar'
import { BoardView } from '@/components/views/BoardView'
import { CalendarView } from '@/components/views/CalendarView'
import { useUIStore } from '@/stores/uiStore'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { BulkActionBar } from '@/components/common/BulkActionBar'
import { applyViewFilters, applyViewSort, groupTasks } from '@/lib/viewUtils'
import { useNavigate } from 'react-router-dom'
import type { Project, Task, Section, Label } from '@/lib/types'

interface ProjectViewProps {
  project: Project
}

export function ProjectView({ project }: ProjectViewProps) {
  const { data: tasks = [], isLoading } = useProjectTasks(project.id)
  const { data: labelsMap } = useAllTaskLabelsMap()
  const { data: sections = [] } = useProjectSections(project.id)
  const archiveProject = useArchiveProject()
  const deleteProject = useDeleteProject()
  const toggleFavorite = useToggleProjectFavorite()
  const createSection = useCreateSection()
  const updateSection = useUpdateSection()
  const deleteSection = useDeleteSection()
  const updateTask = useUpdateTask()
  const reorderTasks = useReorderTasks()
  const reorderSections = useReorderSections()
  const deleteTask = useDeleteTask()
  const navigate = useNavigate()

  const VIEW_ID = `project-${project.id}`
  const { getViewOptions, showConfirmDialog } = useUIStore()
  const opts = getViewOptions(VIEW_ID)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [projectEditorOpen, setProjectEditorOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [defaultSectionId, setDefaultSectionId] = useState<string | null>(null)

  // Section editor (for rename only)
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<Section | null>(null)

  // Inline adders
  const [addingSectionInline, setAddingSectionInline] = useState(false)
  const [addingTaskInSectionId, setAddingTaskInSectionId] = useState<string | null>(null)
  const [addingTaskGeneral, setAddingTaskGeneral] = useState(false)

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
    setDefaultSectionId(null)
  }

  const handleArchive = async () => {
    await archiveProject.mutateAsync(project.id)
    navigate('/app/today')
  }

  const handleDelete = () => {
    showConfirmDialog({
      title: '¿Eliminar proyecto?',
      message: `Se eliminará "${project.name}" junto con todas sus tareas. Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        await deleteProject.mutateAsync(project.id)
        navigate('/app/today')
      },
    })
  }

  const handleAddTaskFromBoard = (sectionId?: string | null) => {
    if (sectionId === undefined) {
      setAddingSectionInline(true)
      return
    }
    setDefaultSectionId(sectionId)
    setEditorOpen(true)
  }

  const handleAddTask = (_dateStr?: string) => {
    setEditorOpen(true)
  }

  const handleSaveSection = (name: string) => {
    if (editingSection) {
      updateSection.mutate({
        id: editingSection.id,
        projectId: project.id,
        updates: { name },
      })
    }
  }

  const handleDeleteSection = (section: Section) => {
    showConfirmDialog({
      title: '¿Eliminar sección?',
      message: `Se eliminará "${section.name}". Las tareas se moverán a "Sin sección".`,
      onConfirm: async () => {
        const sectionTasks = tasks.filter((t) => t.section_id === section.id)
        for (const task of sectionTasks) {
          await updateTask.mutateAsync({ id: task.id, updates: { section_id: null } })
        }
        deleteSection.mutate({ id: section.id, projectId: project.id })
      },
    })
  }

  // Shift+S keyboard shortcut to add section
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable)
        return
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopPropagation()
        setAddingSectionInline(true)
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

  // Group tasks by section for list view
  const tasksBySection = useMemo(() => {
    const map = new Map<string | null, Task[]>()
    map.set(null, [])
    for (const section of sections) {
      map.set(section.id, [])
    }
    for (const task of visibleTasks) {
      const bucket = map.get(task.section_id)
      if (bucket) {
        bucket.push(task)
      } else {
        map.get(null)!.push(task)
      }
    }
    return map
  }, [visibleTasks, sections])

  // Bulk selection (after visibleTasks is computed)
  const { isSelectMode, selectedIds, enter, exit, toggle, selectAll, clearAll, allSelected } =
    useBulkSelection(visibleTasks)

  const handleBulkDelete = () => {
    showConfirmDialog({
      title: `¿Eliminar ${selectedIds.size} ${selectedIds.size === 1 ? 'tarea' : 'tareas'}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        await Promise.all(Array.from(selectedIds).map((id) => deleteTask.mutateAsync(id)))
        exit()
      },
    })
  }

  const handleBulkMoveProject = async (projectId: string, sectionId: string | null) => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        updateTask.mutateAsync({ id, updates: { project_id: projectId, section_id: sectionId } }),
      ),
    )
    exit()
  }

  const handleBulkPriority = async (priority: 1 | 2 | 3 | 4) => {
    await Promise.all(
      Array.from(selectedIds).map((id) => updateTask.mutateAsync({ id, updates: { priority } })),
    )
    exit()
  }

  const handleBulkDueDate = async (date: string | null) => {
    await Promise.all(
      Array.from(selectedIds).map((id) =>
        updateTask.mutateAsync({ id, updates: { due_date: date } }),
      ),
    )
    exit()
  }

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const activeDragItem = useMemo(() => {
    if (!activeDragId) return null
    if (String(activeDragId).startsWith('section:')) {
      const sectionId = String(activeDragId).replace('section:', '')
      const section = sections.find((s) => s.id === sectionId)
      return section ? { type: 'section' as const, item: section } : null
    }
    const task = visibleTasks.find((t) => t.id === activeDragId)
    return task ? { type: 'task' as const, item: task } : null
  }, [activeDragId, sections, visibleTasks])

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeStr = String(active.id)
    const overStr = String(over.id)

    // Section reorder
    if (activeStr.startsWith('section:') && overStr.startsWith('section:')) {
      const activeId = activeStr.replace('section:', '')
      const overId = overStr.replace('section:', '')
      const oldIndex = sections.findIndex((s) => s.id === activeId)
      const newIndex = sections.findIndex((s) => s.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(sections, oldIndex, newIndex)
        reorderSections.mutate({
          projectId: project.id,
          updates: newOrder.map((s, i) => ({ id: s.id, sort_order: i })),
        })
      }
      return
    }

    // Task reorder (same section)
    const activeTask = visibleTasks.find((t) => t.id === activeStr)
    const overTask = visibleTasks.find((t) => t.id === overStr)
    if (activeTask && overTask && activeTask.section_id === overTask.section_id) {
      const sectionTasks = tasksBySection.get(activeTask.section_id) ?? []
      const oldIndex = sectionTasks.findIndex((t) => t.id === activeTask.id)
      const newIndex = sectionTasks.findIndex((t) => t.id === overTask.id)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(sectionTasks, oldIndex, newIndex)
        reorderTasks.mutate({
          projectId: project.id,
          updates: newOrder.map((t, i) => ({ id: t.id, sort_order: i })),
        })
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          />
        ))}
      </div>
    )
  }

  const canDrag = opts.sortBy === 'manual' && opts.groupBy === 'none'

  const renderContent = () => {
    // Panel / Board view
    if (opts.viewStyle === 'panel') {
      return (
        <BoardView
          projectId={project.id}
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
      return <CalendarView calendarMode={opts.calendarMode} onAddTask={handleAddTask} />
    }

    // List view with grouping (priority/label) — no DnD, no sections
    if (opts.groupBy !== 'none') {
      if (visibleTasks.length === 0) {
        return (
          <div className="py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay tareas en este proyecto
            </p>
          </div>
        )
      }
      return (
        <div>
          {groups.map((group) => (
            <TaskGroup
              key={group.key}
              label={group.label}
              color={group.color}
              tasks={group.tasks}
              labelsMap={labelsMap}
              isSelectMode={isSelectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
            />
          ))}
        </div>
      )
    }

    // List view default — section-based with DnD
    const unsectionedTasks = tasksBySection.get(null) ?? []
    const hasSections = sections.length > 0
    const hasAnyContent = visibleTasks.length > 0 || hasSections

    if (!hasAnyContent && !addingTaskGeneral) {
      return (
        <div className="py-12 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No hay tareas en este proyecto
          </p>
        </div>
      )
    }

    const sectionIds = sections.map((s) => `section:${s.id}`)

    const listContent = (
      <>
        {/* Unsectioned tasks */}
        {unsectionedTasks.length > 0 && (
          <div className="mb-4">
            {canDrag ? (
              <SortableContext
                items={unsectionedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="divide-y rounded-lg border"
                  style={{ borderColor: 'var(--border-secondary)' }}
                >
                  {unsectionedTasks.map((task) => (
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      labels={labelsMap?.get(task.id)}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(task.id)}
                      onToggleSelect={toggle}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div
                className="divide-y rounded-lg border"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                {unsectionedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds.has(task.id)}
                    onToggleSelect={toggle}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        {canDrag ? (
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SortableSectionBlock
                key={section.id}
                section={section}
                tasks={tasksBySection.get(section.id) ?? []}
                labelsMap={labelsMap}
                projectId={project.id}
                canDragTasks={canDrag}
                addingTask={addingTaskInSectionId === section.id}
                onStartAddTask={() => setAddingTaskInSectionId(section.id)}
                onCancelAddTask={() => setAddingTaskInSectionId(null)}
                onEdit={() => {
                  setEditingSection(section)
                  setSectionEditorOpen(true)
                }}
                onDelete={() => handleDeleteSection(section)}
                onToggleCollapse={(collapsed) =>
                  updateSection.mutate({
                    id: section.id,
                    projectId: project.id,
                    updates: { collapsed },
                  })
                }
                isSelectMode={isSelectMode}
                selectedIds={selectedIds}
                onToggleSelect={toggle}
              />
            ))}
          </SortableContext>
        ) : (
          sections.map((section) => (
            <StaticSectionBlock
              key={section.id}
              section={section}
              tasks={tasksBySection.get(section.id) ?? []}
              labelsMap={labelsMap}
              projectId={project.id}
              addingTask={addingTaskInSectionId === section.id}
              onStartAddTask={() => setAddingTaskInSectionId(section.id)}
              onCancelAddTask={() => setAddingTaskInSectionId(null)}
              onEdit={() => {
                setEditingSection(section)
                setSectionEditorOpen(true)
              }}
              onDelete={() => handleDeleteSection(section)}
              onToggleCollapse={(collapsed) =>
                updateSection.mutate({
                  id: section.id,
                  projectId: project.id,
                  updates: { collapsed },
                })
              }
              isSelectMode={isSelectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggle}
            />
          ))
        )}
      </>
    )

    if (canDrag) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {listContent}

          <DragOverlay dropAnimation={null}>
            {activeDragItem?.type === 'task' && (
              <div
                className="rounded-lg border shadow-lg opacity-90"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-secondary)',
                }}
              >
                <TaskItem task={activeDragItem.item as Task} />
              </div>
            )}
            {activeDragItem?.type === 'section' && (
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg opacity-90"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                }}
              >
                <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {(activeDragItem.item as Section).name}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )
    }

    return listContent
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {opts.viewStyle !== 'panel' &&
            opts.viewStyle !== 'calendar' &&
            !isSelectMode &&
            visibleTasks.length > 0 && (
              <button
                onClick={enter}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')
                }
              >
                <ListChecks size={14} />
                Seleccionar
              </button>
            )}
          <ViewOptionsBar viewId={VIEW_ID} />

          {!project.is_inbox && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-lg p-1.5 transition-colors hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <MoreHorizontal size={20} />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div
                    className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border py-1 shadow-lg"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setProjectEditorOpen(true)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Pencil size={14} />
                      Editar proyecto
                    </button>
                    <button
                      onClick={() => {
                        toggleFavorite.mutate({
                          id: project.id,
                          isFavorite: !project.is_favorite,
                        })
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Star size={14} />
                      {project.is_favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setAddingSectionInline(true)
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <span className="flex items-center gap-2">
                        <LayoutList size={14} />
                        Agregar sección
                      </span>
                      <span
                        className="rounded px-1.5 py-0.5 font-mono text-[10px]"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        ⇧S
                      </span>
                    </button>
                    <div
                      className="my-1 border-t"
                      style={{ borderColor: 'var(--border-primary)' }}
                    />
                    <button
                      onClick={() => {
                        handleArchive()
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Archive size={14} />
                      Archivar
                    </button>
                    <div
                      className="my-1 border-t"
                      style={{ borderColor: 'var(--border-primary)' }}
                    />
                    <button
                      onClick={() => {
                        handleDelete()
                        setShowMenu(false)
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {project.description}
        </p>
      )}

      {renderContent()}

      {/* Bottom actions (list view only) */}
      {opts.viewStyle !== 'panel' && opts.viewStyle !== 'calendar' && (
        <>
          {addingTaskGeneral ? (
            <TaskEditor
              open
              onClose={() => setAddingTaskGeneral(false)}
              inline
              defaultProjectId={project.id}
            />
          ) : addingSectionInline ? (
            <InlineSectionAdder
              onSave={(name) => {
                createSection.mutate({ project_id: project.id, name })
                setAddingSectionInline(false)
              }}
              onCancel={() => setAddingSectionInline(false)}
            />
          ) : (
            <div className="mt-3 flex items-center gap-1">
              <button
                onClick={() => setAddingTaskGeneral(true)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Plus size={14} />
                Agregar tarea
              </button>
              <span className="text-xs" style={{ color: 'var(--border-primary)' }}>
                |
              </span>
              <button
                onClick={() => setAddingSectionInline(true)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <LayoutList size={14} />
                Agregar sección
              </button>
            </div>
          )}
        </>
      )}

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultProjectId={project.id}
        defaultSectionId={defaultSectionId}
      />

      <ProjectEditor
        open={projectEditorOpen}
        onClose={() => setProjectEditorOpen(false)}
        project={project}
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

      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={visibleTasks.length}
          allSelected={allSelected}
          onSelectAll={selectAll}
          onClearAll={clearAll}
          onExit={exit}
          onDelete={handleBulkDelete}
          onMoveToProject={handleBulkMoveProject}
          onChangePriority={handleBulkPriority}
          onChangeDueDate={handleBulkDueDate}
        />
      )}
    </div>
  )
}

/* ── Inline Section Adder ────────────────────────────── */

function InlineSectionAdder({
  onSave,
  onCancel,
}: {
  onSave: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) {
      onSave(trimmed)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4">
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Dale un nombre a esta sección"
        className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: '#EC1E2A' }}
        >
          Añadir sección
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

/* ── Sortable Task Item ──────────────────────────────── */

function SortableTaskItem({
  task,
  labels,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: {
  task: Task
  labels?: Label[]
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="group/sortable relative"
    >
      {!isSelectMode && (
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 bottom-0 z-10 flex w-6 cursor-grab items-center justify-center opacity-0 transition-opacity group-hover/sortable:opacity-100 active:cursor-grabbing"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </div>
      )}
      <div className={isSelectMode ? undefined : 'pl-5'}>
        <TaskItem
          task={task}
          labels={labels}
          isSelectMode={isSelectMode}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
        />
      </div>
    </div>
  )
}

/* ── Sortable Section Block ──────────────────────────── */

function SortableSectionBlock({
  section,
  tasks,
  labelsMap,
  projectId,
  canDragTasks,
  addingTask,
  onStartAddTask,
  onCancelAddTask,
  onEdit,
  onDelete,
  onToggleCollapse,
  isSelectMode,
  selectedIds,
  onToggleSelect,
}: {
  section: Section
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
  projectId: string
  canDragTasks: boolean
  addingTask: boolean
  onStartAddTask: () => void
  onCancelAddTask: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleCollapse: (collapsed: boolean) => void
  isSelectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `section:${section.id}`,
    data: { type: 'section', section },
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="mb-4"
    >
      {/* Section header */}
      <div className="group/section mb-1.5 flex items-center gap-1 rounded-lg px-1 py-1">
        <div
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex cursor-grab items-center opacity-0 transition-opacity group-hover/section:opacity-100 active:cursor-grabbing"
          style={{ color: 'var(--text-muted)' }}
        >
          <GripVertical size={14} />
        </div>
        <button
          onClick={() => onToggleCollapse(!section.collapsed)}
          className="flex items-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {section.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {section.name}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {tasks.length}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
          <button
            onClick={onStartAddTask}
            className="rounded p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Agregar tarea en esta sección"
          >
            <Plus size={14} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border py-1 shadow-xl"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <button
                    onClick={() => {
                      onEdit()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Pencil size={14} />
                    Renombrar
                  </button>
                  <button
                    onClick={() => {
                      onDelete()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Section tasks */}
      {!section.collapsed && (
        <>
          {tasks.length > 0 ? (
            canDragTasks ? (
              <SortableContext
                items={tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="divide-y rounded-lg border"
                  style={{ borderColor: 'var(--border-secondary)' }}
                >
                  {tasks.map((task) => (
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      labels={labelsMap?.get(task.id)}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds?.has(task.id)}
                      onToggleSelect={onToggleSelect}
                    />
                  ))}
                </div>
              </SortableContext>
            ) : (
              <div
                className="divide-y rounded-lg border"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                {tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    labels={labelsMap?.get(task.id)}
                    isSelectMode={isSelectMode}
                    isSelected={selectedIds?.has(task.id)}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
              </div>
            )
          ) : null}
          {addingTask ? (
            <TaskEditor
              open
              onClose={onCancelAddTask}
              inline
              defaultProjectId={projectId}
              defaultSectionId={section.id}
            />
          ) : (
            <button
              onClick={onStartAddTask}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Plus size={12} />
              Agregar tarea
            </button>
          )}
        </>
      )}
    </div>
  )
}

/* ── Static Section Block (non-draggable) ────────────── */

function StaticSectionBlock({
  section,
  tasks,
  labelsMap,
  projectId,
  addingTask,
  onStartAddTask,
  onCancelAddTask,
  onEdit,
  onDelete,
  onToggleCollapse,
  isSelectMode,
  selectedIds,
  onToggleSelect,
}: {
  section: Section
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
  projectId: string
  addingTask: boolean
  onStartAddTask: () => void
  onCancelAddTask: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleCollapse: (collapsed: boolean) => void
  isSelectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="mb-4">
      <div className="group/section mb-1.5 flex items-center gap-2 rounded-lg px-1 py-1">
        <button
          onClick={() => onToggleCollapse(!section.collapsed)}
          className="flex items-center"
          style={{ color: 'var(--text-muted)' }}
        >
          {section.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {section.name}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {tasks.length}
        </span>
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
          <button
            onClick={onStartAddTask}
            className="rounded p-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            title="Agregar tarea en esta sección"
          >
            <Plus size={14} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border py-1 shadow-xl"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  <button
                    onClick={() => {
                      onEdit()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Pencil size={14} />
                    Renombrar
                  </button>
                  <button
                    onClick={() => {
                      onDelete()
                      setMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors"
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!section.collapsed && (
        <>
          {tasks.length > 0 ? (
            <div
              className="divide-y rounded-lg border"
              style={{ borderColor: 'var(--border-secondary)' }}
            >
              {tasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  labels={labelsMap?.get(task.id)}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds?.has(task.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          ) : null}
          {addingTask ? (
            <TaskEditor
              open
              onClose={onCancelAddTask}
              inline
              defaultProjectId={projectId}
              defaultSectionId={section.id}
            />
          ) : (
            <button
              onClick={onStartAddTask}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Plus size={12} />
              Agregar tarea
            </button>
          )}
        </>
      )}
    </div>
  )
}
