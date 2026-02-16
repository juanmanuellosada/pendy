import { useState, useEffect } from 'react'
import { Flag, ChevronDown } from 'lucide-react'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useProjects, useInboxProject } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types'

interface TaskEditorProps {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultProjectId?: string
}

export function TaskEditor({ open, onClose, task, defaultProjectId }: TaskEditorProps) {
  const { user } = useAuth()
  const { data: projects = [] } = useProjects()
  const { data: inboxProject } = useInboxProject()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(4)
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setDueDate(task.due_date ?? '')
      setProjectId(task.project_id)
    } else {
      setTitle('')
      setDescription('')
      setPriority(4)
      setDueDate('')
      setProjectId(defaultProjectId ?? inboxProject?.id ?? '')
    }
  }, [task, open, defaultProjectId, inboxProject])

  const handleSubmit = async () => {
    if (!title.trim() || !user) return

    const targetProjectId = projectId || inboxProject?.id
    if (!targetProjectId) return

    if (task) {
      await updateTask.mutateAsync({
        id: task.id,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          due_date: dueDate || null,
          project_id: targetProjectId,
        },
      })
    } else {
      await createTask.mutateAsync({
        user_id: user.id,
        project_id: targetProjectId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
      })
    }

    onClose()
  }

  if (!open) return null

  const selectedProject = projects.find((p) => p.id === projectId) ?? inboxProject

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div className="p-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-sm font-medium outline-none"
            style={{ backgroundColor: 'transparent', color: 'var(--text-primary)' }}
            placeholder="Nombre de la tarea"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full resize-none text-sm outline-none"
            style={{ backgroundColor: 'transparent', color: 'var(--text-secondary)' }}
            placeholder="Descripcion"
            rows={2}
          />

          {/* Action bar */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Due date */}
            <div className="relative">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Priority */}
            <div className="relative">
              <button
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <Flag size={12} style={{ color: PRIORITY_COLORS[priority] }} />
                {PRIORITY_LABELS[priority]}
                <ChevronDown size={12} />
              </button>
              {showPriorityMenu && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border py-1 shadow-lg"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  {([1, 2, 3, 4] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPriority(p)
                        setShowPriorityMenu(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                      )}
                      style={{ color: 'var(--text-primary)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Flag size={14} style={{ color: PRIORITY_COLORS[p] }} />
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Project */}
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: selectedProject?.color ?? '#283B56' }}
                />
                {selectedProject?.name ?? 'Entrada'}
                <ChevronDown size={12} />
              </button>
              {showProjectMenu && (
                <div
                  className="absolute left-0 top-full z-20 mt-1 max-h-48 w-48 overflow-y-auto rounded-lg border py-1 shadow-lg"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                  }}
                >
                  {projects
                    .filter((p) => !p.is_archived)
                    .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProjectId(p.id)
                          setShowProjectMenu(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="truncate">{p.name}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || createTask.isPending || updateTask.isPending}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#283B56' }}
          >
            {task ? 'Guardar' : 'Agregar tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}
