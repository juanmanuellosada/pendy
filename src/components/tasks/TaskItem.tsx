import { memo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Flag, MoreHorizontal, Clock, Check, Repeat } from 'lucide-react'
import { TaskCheckbox } from './TaskCheckbox'
import { TaskContextMenu } from './TaskContextMenu'
import { TaskTooltip } from '@/components/common/TaskTooltip'
import { cn, stripHtmlTags, stripLabelTokensFromHtml } from '@/lib/utils'
import { formatRelativeDate, isOverdue } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/constants'
import { useCompleteTask } from '@/hooks/useTasks'
import { useAppStore } from '@/stores/appStore'
import type { Task, Label } from '@/lib/types'

interface TaskItemProps {
  task: Task
  onEdit?: (task: Task) => void
  showProject?: boolean
  labels?: Label[]
  compact?: boolean
  // Bulk selection
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export const TaskItem = memo(function TaskItem({
  task,
  labels = [],
  compact,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: TaskItemProps) {
  const navigate = useNavigate()
  const completeTask = useCompleteTask()
  const { setSelectedTaskId } = useAppStore()
  const moreButtonRef = useRef<HTMLButtonElement>(null)
  const [completing, setCompleting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isSelectMode) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleComplete = (checked: boolean) => {
    setCompleting(checked)
    setTimeout(() => {
      completeTask.mutate({ id: task.id, completed: checked, task })
    }, 300)
  }

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = moreButtonRef.current?.getBoundingClientRect()
    if (rect) {
      setContextMenu({ x: rect.left, y: rect.bottom + 4 })
    }
  }

  const handleClick = () => {
    if (isSelectMode) {
      onToggleSelect?.(task.id)
      return
    }
    setSelectedTaskId(task.id)
  }

  const dueDateOverdue = task.due_date && isOverdue(task.due_date) && !task.is_completed

  const rowBg = isSelected ? 'color-mix(in srgb, var(--color-link) 8%, transparent)' : 'transparent'
  const rowBgHover = isSelected
    ? 'color-mix(in srgb, var(--color-link) 14%, transparent)'
    : 'var(--bg-hover)'

  const inner = (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-lg transition-colors cursor-pointer animate-fade-in',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        completing && !isSelectMode && 'task-completing',
      )}
      style={{ backgroundColor: rowBg }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = rowBgHover)}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = rowBg
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Checkbox / Selection indicator */}
      <div className="flex-shrink-0 flex items-center justify-center min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 md:pt-0.5">
        {isSelectMode ? (
          <div
            className="h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors"
            style={{
              borderColor: isSelected ? 'var(--color-link)' : 'var(--text-muted)',
              backgroundColor: isSelected ? 'var(--color-link)' : 'transparent',
            }}
          >
            {isSelected && <Check size={9} color="white" />}
          </div>
        ) : (
          <TaskCheckbox
            checked={task.is_completed || completing}
            priority={task.priority}
            onChange={handleComplete}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            'tiptap text-sm leading-snug transition-all block',
            (task.is_completed || completing) && !isSelectMode && 'line-through opacity-50',
          )}
          style={{ color: 'var(--text-primary)' }}
          onClick={(e) => {
            const anchor = (e.target as HTMLElement).closest('a')
            if (anchor) {
              e.stopPropagation()
              e.preventDefault()
              window.open(anchor.getAttribute('href') ?? '', '_blank', 'noopener')
            }
          }}
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
              style={{ color: dueDateOverdue ? 'var(--color-accent)' : 'var(--text-secondary)' }}
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
              {task.is_recurring && <Repeat size={11} className="ml-0.5" />}
            </span>
          )}

          {task.priority < 4 && (
            <span
              className="flex items-center gap-1 text-xs"
              aria-label={
                task.priority === 1
                  ? 'Prioridad urgente'
                  : task.priority === 2
                    ? 'Prioridad alta'
                    : 'Prioridad media'
              }
            >
              <Flag size={12} style={{ color: PRIORITY_COLORS[task.priority] }} />
            </span>
          )}

          {labels.map((label) => (
            <button
              key={label.id}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/app/label/${label.id}`)
              }}
              className="rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
              style={{
                backgroundColor: label.color + '22',
                color: label.color,
              }}
            >
              {label.name}
            </button>
          ))}
        </div>
      </div>

      {/* More options — hidden in select mode */}
      {!isSelectMode && (
        <div className="flex shrink-0 items-center gap-1 opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
          <button
            ref={moreButtonRef}
            onClick={handleMoreClick}
            className="rounded p-2 md:p-1 transition-colors hover:opacity-70 min-w-[32px] min-h-[32px] flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Más opciones"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      )}
    </div>
  )

  if (isSelectMode) {
    return (
      <>
        {inner}
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
  }

  return (
    <>
      <TaskTooltip task={task} disabled={!!contextMenu}>
        {inner}
      </TaskTooltip>

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
