import { useEffect, useState, useRef, type RefObject } from 'react'

/**
 * Calculates fixed positioning for a dropdown that needs to escape
 * overflow clipping (e.g., inside a scrollable panel).
 *
 * - Flips horizontally if overflows right edge.
 * - Flips vertically (opens upward) if more space above than below.
 * - Returns `maxHeight` so the caller can constrain the panel height.
 *
 * Recalculates on scroll (capture phase) and resize so the position
 * stays anchored to the trigger even when the container scrolls.
 */
export function useFloatingPosition(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  dropdownWidth: number,
): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>({ top: 0, left: 0 })
  // Track previous serialized style to skip re-renders when position hasn't changed
  const prevSerializedRef = useRef('')

  useEffect(() => {
    if (!open || !containerRef.current) return

    const update = () => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // ── Horizontal: prefer left-aligned, flip if overflows right edge ──
      let left = rect.left
      if (left + dropdownWidth > vw - 8) {
        left = rect.right - dropdownWidth
      }
      left = Math.max(8, Math.min(left, vw - dropdownWidth - 8))

      // ── Vertical: flip to above if more space above than below ──────────
      const spaceBelow = vh - rect.bottom - 8
      const spaceAbove = rect.top - 8

      let computed: React.CSSProperties

      if (spaceBelow >= 250 || spaceBelow >= spaceAbove) {
        // Open downward
        computed = {
          position: 'fixed',
          top: rect.bottom + 4,
          left,
          maxHeight: Math.max(200, spaceBelow - 4),
          zIndex: 9999,
        }
      } else {
        // Open upward: anchor bottom of panel to top of trigger
        computed = {
          position: 'fixed',
          bottom: vh - rect.top + 4,
          left,
          maxHeight: Math.max(200, spaceAbove - 4),
          zIndex: 9999,
        }
      }

      // Only call setStyle when the position actually changed to avoid
      // re-renders (and scroll-position resets) triggered by inner scroll events
      const serialized = JSON.stringify(computed)
      if (serialized === prevSerializedRef.current) return
      prevSerializedRef.current = serialized
      setStyle(computed)
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

  return style
}
