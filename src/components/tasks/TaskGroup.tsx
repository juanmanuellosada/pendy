import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TaskItem } from './TaskItem'
import type { Task, Label } from '@/lib/types'

interface TaskGroupProps {
  label: string
  color?: string
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
  defaultOpen?: boolean
  // Bulk selection
  isSelectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function TaskGroup({
  label,
  color,
  tasks,
  labelsMap,
  defaultOpen = true,
  isSelectMode,
  selectedIds,
  onToggleSelect,
}: TaskGroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        {open ? (
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
        )}
        {color && (
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {tasks.length}
        </span>
      </button>

      {open && tasks.length > 0 && (
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
      )}
    </div>
  )
}
