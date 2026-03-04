import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TaskItem } from './TaskItem'
import type { Task, Label } from '@/lib/types'

const ESTIMATED_ROW_HEIGHT = 64

interface VirtualTaskListProps {
  tasks: Task[]
  labelsMap?: Map<string, Label[]>
  isSelectMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function VirtualTaskList({
  tasks,
  labelsMap,
  isSelectMode,
  selectedIds,
  onToggleSelect,
}: VirtualTaskListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () =>
      parentRef.current?.closest('[class*="overflow-y-auto"]') as HTMLElement | null,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  })

  // For small lists, skip virtualization overhead
  if (tasks.length < 50) {
    return (
      <div className="divide-y" style={{ borderColor: 'var(--border-secondary)' }}>
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
  }

  return (
    <div ref={parentRef}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const task = tasks[virtualRow.index]!
          return (
            <div
              key={task.id}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <TaskItem
                task={task}
                labels={labelsMap?.get(task.id)}
                isSelectMode={isSelectMode}
                isSelected={selectedIds?.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
