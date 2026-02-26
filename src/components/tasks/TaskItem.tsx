import { memo, useState } from 'react'
import { Calendar, Flag, MoreHorizontal, Trash2, Clock } from 'lucide-react'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskContextMenu } from './TaskContextMenu'
import { cn, stripHtmlTags, stripLabelTokensFromHtml } from '@/lib/utils'
import { formatRelativeDate, isOverdue } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/constants'
import { useCompleteTask, useDeleteTask } from '@/hooks/useTasks'
import { useAppStore } from '@/stores/appStore'
import { useUIStore } from '@/stores/uiStore'
import type { Task, Label } from '@/lib/types'

interface TaskItemProps {
  task: Task
  onEdit?: (task: Task) => void
  showProject?: boolean
  labels?: Label[]
  compact?: boolean
}

export const TaskItem = memo(function TaskItem({
  task,
  labels = [],
  compact,
}: TaskItemProps) {
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const { setSelectedTaskId } = useAppStore()
  const { showConfirmDialog } = useUIStore()
  const [showMenu, setShowMenu] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleComplete = (checked: boolean) => {
    setCompleting(checked)
    setTimeout(() => {
      completeTask.mutate({ id: task.id, completed: checked })
    }, 300)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    showConfirmDialog({
      title: '¿Eliminar tarea?',
      message: 'Esta acción no se puede deshacer. La tarea será eliminada permanentemente.',
      onConfirm: () => deleteTask.mutate(task.id),
    })
  }

  const dueDateOverdue = task.due_date && isOverdue(task.due_date) && !task.is_completed

  return (
    <>
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg transition-colors cursor-pointer animate-fade-in',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        completing && 'task-completing',
      )}
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent'
        setShowMenu(false)
      }}
      onClick={() => setSelectedTaskId(task.id)}
      onContextMenu={handleContextMenu}
    >
      <div className="pt-0.5">
        <TaskCheckbox
          checked={task.is_completed || completing}
          priority={task.priority}
          onChange={handleComplete}
        />
      </div>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'tiptap text-sm leading-snug transition-all block',
            (task.is_completed || completing) && 'line-through opacity-50',
          )}
          style={{ color: 'var(--text-primary)' }}
          dangerouslySetInnerHTML={{
            __html: stripLabelTokensFromHtml(task.title).replace(/^<p>(.*)<\/p>$/, '$1'),
          }}
        />

        {task.description && (
          <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {stripHtmlTags(task.description).slice(0, 80)}
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
              {task.has_time && task.due_datetime && (
                <>
                  <Clock size={11} className="ml-1" />
                  {new Date(task.due_datetime).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
            </span>
          )}

          {task.priority < 4 && (
            <span className="flex items-center gap-1 text-xs">
              <Flag size={12} style={{ color: PRIORITY_COLORS[task.priority] }} />
            </span>
          )}

          {labels.map((label) => (
            <span
              key={label.id}
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: label.color + '22',
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
                onClick={handleDelete}
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

    {contextMenu && (
      <TaskContextMenu
        task={task}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
      />
    )}
    </>
  )
})
