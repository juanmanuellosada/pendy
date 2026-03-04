import { useMemo, useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useProjectSections, useDeleteSection } from '@/hooks/useSections'
import { useUpdateTask } from '@/hooks/useTasks'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { useUIStore } from '@/stores/uiStore'
import { TaskItem } from '@/components/tasks/TaskItem'
import { cn } from '@/lib/utils'
import type { Task, Section } from '@/lib/types'

interface BoardViewProps {
  projectId: string
  tasks: Task[]
  onAddTask: (sectionId?: string | null) => void
  onEditSection?: (section: Section) => void
}

export function BoardView({ projectId, tasks, onAddTask, onEditSection }: BoardViewProps) {
  const { data: sections = [] } = useProjectSections(projectId)
  const { data: labelsMap } = useAllTaskLabelsMap()
  const updateTask = useUpdateTask()
  const deleteSection = useDeleteSection()
  const { showConfirmDialog } = useUIStore()

  const columns = useMemo(() => {
    const noSectionTasks = tasks.filter((t) => !t.section_id && !t.is_completed)
    const cols: { id: string | null; name: string; tasks: Task[]; section?: Section }[] = [
      { id: null, name: 'Sin sección', tasks: noSectionTasks },
    ]

    for (const section of sections) {
      const sectionTasks = tasks.filter((t) => t.section_id === section.id && !t.is_completed)
      cols.push({ id: section.id, name: section.name, tasks: sectionTasks, section })
    }

    return cols
  }, [tasks, sections])

  const handleDrop = (e: React.DragEvent, sectionId: string | null) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) {
      updateTask.mutate({ id: taskId, updates: { section_id: sectionId } })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDeleteSection = (section: Section) => {
    showConfirmDialog({
      title: '¿Eliminar sección?',
      message: `Se eliminará "${section.name}". Las tareas se moverán a "Sin sección".`,
      onConfirm: async () => {
        // Move tasks to no section first
        const sectionTasks = tasks.filter((t) => t.section_id === section.id)
        for (const task of sectionTasks) {
          await updateTask.mutateAsync({ id: task.id, updates: { section_id: null } })
        }
        deleteSection.mutate({ id: section.id, projectId })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map((col) => (
        <BoardColumn
          key={col.id ?? '__none__'}
          column={col}
          labelsMap={labelsMap}
          onAddTask={() => onAddTask(col.id)}
          onDrop={(e) => handleDrop(e, col.id)}
          onDragOver={handleDragOver}
          onDeleteSection={col.section ? () => handleDeleteSection(col.section!) : undefined}
          onEditSection={
            col.section && onEditSection ? () => onEditSection(col.section!) : undefined
          }
        />
      ))}

      {/* Add column button */}
      <div className="md:flex-shrink-0 md:w-[300px]">
        <button
          onClick={() => onAddTask(undefined)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-medium transition-colors hover-bg-hover"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-muted)',
          }}
        >
          <Plus size={16} />
          Agregar sección
        </button>
      </div>
    </div>
  )
}

/* ── Board Column ────────────────────────────────────── */

function BoardColumn({
  column,
  labelsMap,
  onAddTask,
  onDrop,
  onDragOver,
  onDeleteSection,
  onEditSection,
}: {
  column: { id: string | null; name: string; tasks: Task[]; section?: Section }
  labelsMap: Map<string, import('@/lib/types').Label[]> | undefined
  onAddTask: () => void
  onDrop: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDeleteSection?: () => void
  onEditSection?: () => void
}) {
  const [isOver, setIsOver] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl transition-colors w-full md:w-[300px] md:flex-shrink-0',
      )}
      style={{
        backgroundColor: isOver ? 'var(--bg-active)' : 'var(--bg-secondary)',
      }}
      onDragOver={(e) => {
        onDragOver(e)
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        onDrop(e)
        setIsOver(false)
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {column.name}
          </h3>
          <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {column.tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onAddTask}
            className="rounded-lg p-1 transition-colors hover-bg-hover"
            style={{ color: 'var(--text-muted)' }}
            title="Agregar tarea"
          >
            <Plus size={16} />
          </button>
          {column.section && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-lg p-1 transition-colors hover-bg-hover"
                style={{ color: 'var(--text-muted)' }}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <SectionMenu
                  onEdit={() => {
                    onEditSection?.()
                    setMenuOpen(false)
                  }}
                  onDelete={() => {
                    onDeleteSection?.()
                    setMenuOpen(false)
                  }}
                  onClose={() => setMenuOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-1 px-2 pb-2 min-h-[60px]">
        {column.tasks.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg py-8 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Sin tareas
          </div>
        ) : (
          column.tasks.map((task) => (
            <div
              key={task.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', task.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              className="rounded-lg border cursor-grab active:cursor-grabbing"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-secondary)',
              }}
            >
              <TaskItem task={task} labels={labelsMap?.get(task.id)} compact />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Section Menu ────────────────────────────────────── */

function SectionMenu({
  onEdit,
  onDelete,
  onClose,
}: {
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border py-1 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <button
          onClick={onEdit}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover-bg-hover"
          style={{ color: 'var(--text-primary)' }}
        >
          <Pencil size={14} />
          Renombrar
        </button>
        <button
          onClick={onDelete}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-500 transition-colors hover-bg-hover"
        >
          <Trash2 size={14} />
          Eliminar
        </button>
      </div>
    </>
  )
}
