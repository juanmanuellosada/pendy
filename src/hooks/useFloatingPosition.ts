import { useEffect, useState, type RefObject } from 'react'

/**
 * Calculates fixed positioning for a dropdown that needs to escape
 * overflow clipping (e.g., inside a scrollable panel).
 *
 * Returns a style object with { position: 'fixed', top, left, zIndex }.
 * The dropdown is positioned below the trigger and flips horizontally
 * if it would overflow the viewport.
 *
 * Recalculates on scroll (capture phase) and resize so position stays
 * anchored to the trigger even when the container scrolls.
 */
export function useFloatingPosition(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  dropdownWidth: number,
): React.CSSProperties {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !containerRef.current) return

    const update = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth

      // Horizontal: prefer left-aligned, flip if overflows right edge
      let left = rect.left
      if (left + dropdownWidth > vw - 8) {
        left = rect.right - dropdownWidth
      }
      left = Math.max(8, Math.min(left, vw - dropdownWidth - 8))

      // Vertical: below trigger
      setPos({ top: rect.bottom + 4, left })
    }

    update()

    // Capture phase to catch scroll inside any container
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, dropdownWidth, containerRef])

  return {
    position: 'fixed' as const,
    top: pos.top,
    left: pos.left,
    zIndex: 9999,
  }
}
