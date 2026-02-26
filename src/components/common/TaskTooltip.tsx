import { useState, useRef, useEffect, cloneElement, isValidElement } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlignLeft, Hash, Calendar, Repeat, Tag } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useAllTaskLabelsMap } from '@/hooks/useLabels'
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox'
import { cn, stripHtmlTags, stripLabelTokensFromText } from '@/lib/utils'
import type { Task } from '@/lib/types'

interface TaskTooltipProps {
  task: Task
  children: React.ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
  }>
  disabled?: boolean
}

export function TaskTooltip({ task, children, disabled }: TaskTooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const { data: projects } = useProjects()
  const { data: labelsMap } = useAllTaskLabelsMap()

  const labels = labelsMap?.get(task.id) ?? []
  const project = projects?.find((p) => p.id === task.project_id)
  const parentProject = project?.parent_id
    ? projects?.find((p) => p.id === project.parent_id)
    : null
  const description = task.description ? stripHtmlTags(task.description).trim() : ''

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: rect.left, y: rect.top, w: rect.width })
    timerRef.current = setTimeout(() => setShow(true), 400)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setShow(false)
  }

  // Hide when disabled changes (e.g., drag starts)
  useEffect(() => {
    if (disabled) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      setShow(false)
    }
  }, [disabled])

  // Clean up timer on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  // Position tooltip
  useEffect(() => {
    if (!show || !tooltipRef.current) return
    const tt = tooltipRef.current
    const rect = tt.getBoundingClientRect()
    const vh = window.innerHeight

    // Try left of the element
    let left = pos.x - rect.width - 8
    // If not enough space on left, place to the right
    if (left < 8) left = pos.x + pos.w + 8

    let top = pos.y
    if (top + rect.height > vh - 8) top = vh - rect.height - 8
    if (top < 8) top = 8

    tt.style.left = `${left}px`
    tt.style.top = `${top}px`
  }, [show, pos])

  // Format date/time
  let dateLabel = ''
  if (task.due_date) {
    const d = new Date(task.due_date + 'T00:00:00')
    dateLabel = format(d, "EEEE d/MM", { locale: es })
  }
  let timeLabel = ''
  if (task.has_time && task.due_datetime) {
    const dt = new Date(task.due_datetime)
    const startH = dt.getHours()
    const startM = dt.getMinutes()
    const duration = task.duration_minutes || 60
    const endTotalMin = startH * 60 + startM + duration
    const endH = Math.floor(endTotalMin / 60) % 24
    const endM = endTotalMin % 60
    timeLabel = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}-${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  // Clone child to inject mouse handlers
  const child = isValidElement(children)
    ? cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          handleMouseEnter(e)
          children.props.onMouseEnter?.(e)
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleMouseLeave()
          children.props.onMouseLeave?.(e)
        },
        onMouseDown: (e: React.MouseEvent) => {
          handleMouseLeave() // cancel/hide tooltip on interaction
          children.props.onMouseDown?.(e)
        },
      })
    : children

  return (
    <>
      {child}
      {show &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[100] w-64 rounded-xl p-3 shadow-2xl border pointer-events-none animate-fade-in"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
              left: -9999,
              top: -9999,
            }}
          >
            {/* Title */}
            <div className="flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <TaskCheckbox
                  checked={task.is_completed}
                  priority={task.priority}
                  onChange={() => {}}
                />
              </div>
              <p
                className={cn(
                  'text-sm font-medium leading-snug',
                  task.is_completed && 'line-through opacity-60',
                )}
                style={{ color: 'var(--text-primary)' }}
              >
                {stripLabelTokensFromText(stripHtmlTags(task.title))}
              </p>
            </div>

            {/* Description */}
            {description && (
              <div className="mt-2 flex items-start gap-2">
                <AlignLeft size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <p
                  className="text-xs leading-relaxed line-clamp-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {description}
                </p>
              </div>
            )}

            {/* Project */}
            {project && (
              <div className="mt-2 flex items-center gap-2">
                <Hash size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {parentProject && (
                    <>
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: parentProject.color }}
                      />
                      <span>{parentProject.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>/</span>
                    </>
                  )}
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: project.color }}
                  />
                  <span>{project.name}</span>
                </div>
              </div>
            )}

            {/* Date/time */}
            {(dateLabel || timeLabel) && (
              <div className="mt-2 flex items-center gap-2">
                <Calendar size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {dateLabel}
                  {timeLabel && ` ${timeLabel}`}
                </span>
                {task.is_recurring && (
                  <Repeat size={12} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
            )}

            {/* Labels */}
            {labels.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <Tag size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                {labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: label.color + '20', color: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
