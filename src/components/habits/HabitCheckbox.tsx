import { Check, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playCompletionSound, playUncompleteSound } from '@/lib/sound'

interface HabitCheckboxProps {
  completed: boolean
  color: string
  onChange: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function HabitCheckbox({
  completed,
  color,
  onChange,
  disabled = false,
  size = 'md',
}: HabitCheckboxProps) {
  const dim = size === 'sm' ? 18 : 22
  const iconSize = size === 'sm' ? 10 : 13

  const handleClick = () => {
    if (completed) playUncompleteSound()
    else playCompletionSound()
    onChange()
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'flex flex-shrink-0 items-center justify-center transition-all duration-200',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'hover:scale-110 active:scale-95',
      )}
      style={{
        width: dim,
        height: dim,
        borderRadius: 6,
        border: `2px solid ${color}`,
        backgroundColor: completed ? color : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      aria-label={completed ? 'Marcar como no completado' : 'Marcar como completado'}
    >
      {completed ? (
        <Check size={iconSize} color="#FFFFFF" strokeWidth={3} />
      ) : (
        <Repeat size={iconSize} color={color} strokeWidth={2} style={{ opacity: 0.5 }} />
      )}
    </button>
  )
}
