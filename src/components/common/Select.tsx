import { useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  /** Extra class applied to the dropdown panel. Useful for overriding min-width. */
  panelClassName?: string
}

export function Select({
  value,
  options,
  onChange,
  disabled = false,
  placeholder,
  className = '',
  style,
  panelClassName = '',
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder ?? ''

  const openPanel = useCallback(() => {
    if (disabled) return
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const panelH = Math.min(240, options.length * 36 + 8)
      const spaceBelow = window.innerHeight - rect.bottom
      const top =
        spaceBelow >= panelH
          ? rect.bottom + window.scrollY + 4
          : rect.top + window.scrollY - panelH - 4
      setPanelPos({
        top,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }
    setOpen(true)
  }, [disabled, options.length])

  const closePanel = useCallback(() => setOpen(false), [])

  const select = useCallback(
    (val: string) => {
      onChange(val)
      closePanel()
    },
    [onChange, closePanel],
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        panelRef.current?.contains(e.target as Node)
      )
        return
      closePanel()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closePanel])

  // Close on scroll or resize.
  // The scroll listener uses capture phase (true) to catch ancestor scroll containers.
  // We ignore scroll events whose target is inside the panel or the trigger — those are
  // either the open-time scrollIntoView call (panel-internal) or user scrolling the
  // options list. Only a genuine page/ancestor scroll (target outside both) closes the
  // panel. This is deterministic and removes the need for any timing hacks.
  useEffect(() => {
    if (!open) return

    const handleScroll = (e: Event) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      )
        return
      closePanel()
    }

    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', closePanel)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', closePanel)
    }
  }, [open, closePanel])

  // Keyboard navigation on the trigger button
  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      closePanel()
      return
    }
    if (
      !open &&
      (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')
    ) {
      e.preventDefault()
      openPanel()
      return
    }
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      if (!items || items.length === 0) return
      const arr = Array.from(items)
      const focused = document.activeElement
      const idx = arr.indexOf(focused as HTMLButtonElement)
      if (idx === -1) {
        // Focus is still on the trigger — move into panel
        const selectedEl =
          panelRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
        if (selectedEl) {
          selectedEl.focus()
        } else {
          arr[0]?.focus()
        }
      } else {
        const next =
          e.key === 'ArrowDown' ? Math.min(idx + 1, arr.length - 1) : Math.max(idx - 1, 0)
        arr[next]?.focus()
      }
    }
  }

  // Keyboard navigation inside the panel
  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      closePanel()
      triggerRef.current?.focus()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = panelRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      if (!items) return
      const focused = document.activeElement
      const arr = Array.from(items)
      const idx = arr.indexOf(focused as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? Math.min(idx + 1, arr.length - 1) : Math.max(idx - 1, 0)
      arr[next]?.focus()
    }
  }

  // Scroll selected option into view when panel opens
  useEffect(() => {
    if (!open) return
    // Small delay so the portal renders first
    const raf = requestAnimationFrame(() => {
      const selected = panelRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' })
        selected.focus()
      } else {
        const first = panelRef.current?.querySelector<HTMLButtonElement>('[role="option"]')
        first?.focus()
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          role="listbox"
          id={listboxId}
          aria-label="Opciones"
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          onMouseDown={(e) => e.preventDefault()}
          className={`fixed z-[9999] overflow-y-auto rounded-lg border py-1 ${panelClassName}`}
          style={{
            top: panelPos.top,
            left: panelPos.left,
            minWidth: panelPos.width,
            maxHeight: 240,
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => select(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm outline-none transition-colors"
                style={{
                  color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                  backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = isSelected
                    ? 'var(--bg-active)'
                    : 'transparent')
                }
                onFocus={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onBlur={(e) =>
                  (e.currentTarget.style.backgroundColor = isSelected
                    ? 'var(--bg-active)'
                    : 'transparent')
                }
              >
                <span className="flex-1 text-left">{opt.label}</span>
                {isSelected && (
                  <Check size={14} style={{ flexShrink: 0, color: 'var(--color-primary)' }} />
                )}
              </button>
            )
          })}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closePanel() : openPanel())}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors ${className}`}
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: open ? 'var(--color-primary)' : 'var(--border-primary)',
          color: options.some((o) => o.value === value)
            ? 'var(--text-primary)'
            : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          ...style,
        }}
      >
        <span className="flex-1 text-left">{selectedLabel}</span>
        <ChevronDown
          size={14}
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.15s',
          }}
        />
      </button>
      {panel}
    </>
  )
}
