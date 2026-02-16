import { memo, useState } from 'react'
import { Calendar, Flag, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { TaskCheckbox } from './TaskCheckbox'
import { cn } from '@/lib/utils'
import { formatRelativeDate, isOverdue } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/constants'
import { useCompleteTask, useDeleteTask } from '@/hooks/useTasks'
import { useAppStore } from '@/stores/appStore'
import type { Task } from '@/lib/types'

interface TaskItemProps {
  task: Task
  onEdit?: (task: Task) => void
  showProject?: boolean
}

export const TaskItem = memo(function TaskItem({ task, onEdit, showProject: _showProject }: TaskItemProps) {
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const { setSelectedTaskId } = useAppStore()
  const [showMenu, setShowMenu] = useState(false)
  const [completing, setCompleting] = useState(false)

  const handleComplete = (checked: boolean) => {
    setCompleting(checked)
    setTimeout(() => {
      completeTask.mutate({ id: task.id, completed: checked })
    }, 300)
  }

  const handleDelete = () => {
    deleteTask.mutate(task.id)
    setShowMenu(false)
  }

  const dueDateOverdue = task.due_date && isOverdue(task.due_date) && !task.is_completed

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors cursor-pointer animate-fade-in',
        completing && 'task-completing',
      )}
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        setShowMenu(false)
      }}
      onClick={() => setSelectedTaskId(task.id)}
    >
      <div className="pt-0.5">
        <TaskCheckbox
          checked={task.is_completed || completing}
          priority={task.priority}
          onChange={handleComplete}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-sm leading-snug transition-all',
            (task.is_completed || completing) && 'line-through opacity-50',
          )}
          style={{ color: 'var(--text-primary)' }}
        >
          {task.title}
        </p>

        {task.description && (
          <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {task.description}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.due_date && (
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: dueDateOverdue ? '#EC1E2A' : 'var(--text-secondary)' }}
            >
              <Calendar size={12} />
              {formatRelativeDate(task.due_date)}
            </span>
          )}

          {task.priority < 4 && (
            <span className="flex items-center gap-1 text-xs">
              <Flag size={12} style={{ color: PRIORITY_COLORS[task.priority] }} />
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(task)
            }}
            className="rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
        )}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border py-1 shadow-lg"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
