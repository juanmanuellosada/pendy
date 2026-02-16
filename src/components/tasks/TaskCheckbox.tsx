import { memo } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_COLORS } from '@/lib/constants'

interface TaskCheckboxProps {
  checked: boolean
  priority: 1 | 2 | 3 | 4
  onChange: (checked: boolean) => void
}

export const TaskCheckbox = memo(function TaskCheckbox({
  checked,
  priority,
  onChange,
}: TaskCheckboxProps) {
  const color = PRIORITY_COLORS[priority]

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cn(
        'checkbox-custom flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
        checked && 'animate-task-complete',
      )}
      style={{
        borderColor: color,
        backgroundColor: checked ? color : 'transparent',
      }}
      aria-label={checked ? 'Marcar como pendiente' : 'Marcar como completada'}
    >
      {checked && <Check size={12} className="text-white" strokeWidth={3} />}
    </button>
  )
})
