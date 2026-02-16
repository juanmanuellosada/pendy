import { useState } from 'react'
import { Plus, MoreHorizontal, Archive, Trash2, Pencil, Star } from 'lucide-react'
import { useProjectTasks } from '@/hooks/useTasks'
import { useArchiveProject, useDeleteProject, useToggleProjectFavorite } from '@/hooks/useProjects'
import { TaskList } from '@/components/tasks/TaskList'
import { TaskEditor } from '@/components/tasks/TaskEditor'
import { ProjectEditor } from './ProjectEditor'
import { useNavigate } from 'react-router-dom'
import type { Project, Task } from '@/lib/types'

interface ProjectViewProps {
  project: Project
}

export function ProjectView({ project }: ProjectViewProps) {
  const { data: tasks = [], isLoading } = useProjectTasks(project.id)
  const archiveProject = useArchiveProject()
  const deleteProject = useDeleteProject()
  const toggleFavorite = useToggleProjectFavorite()
  const navigate = useNavigate()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [projectEditorOpen, setProjectEditorOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setEditorOpen(true)
  }

  const handleCloseEditor = () => {
    setEditorOpen(false)
    setEditingTask(null)
  }

  const handleArchive = async () => {
    await archiveProject.mutateAsync(project.id)
    navigate('/app/today')
  }

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto y todas sus tareas?')) return
    await deleteProject.mutateAsync(project.id)
    navigate('/app/today')
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#EC1E2A' }}
          >
            <Plus size={16} />
            Agregar tarea
          </button>

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
                <div
                  className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border py-1 shadow-lg"
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Pencil size={14} />
                    Editar proyecto
                  </button>
                  <button
                    onClick={() => {
                      toggleFavorite.mutate({ id: project.id, isFavorite: !project.is_favorite })
                      setShowMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Star size={14} />
                    {project.is_favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  </button>
                  <button
                    onClick={() => {
                      handleArchive()
                      setShowMenu(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Archive size={14} />
                    Archivar
                  </button>
                  <div className="my-1 border-t" style={{ borderColor: 'var(--border-primary)' }} />
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

      <TaskList
        tasks={tasks}
        onEditTask={handleEditTask}
        emptyMessage="No hay tareas en este proyecto"
      />

      <TaskEditor
        open={editorOpen}
        onClose={handleCloseEditor}
        task={editingTask}
        defaultProjectId={project.id}
      />

      <ProjectEditor
        open={projectEditorOpen}
        onClose={() => setProjectEditorOpen(false)}
        project={project}
      />
    </div>
  )
}
