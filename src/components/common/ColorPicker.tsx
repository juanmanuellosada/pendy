import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LABEL_COLORS } from '@/hooks/useLabels'

// ── Color conversion helpers ────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100; v /= 100
  const i = Math.floor(h / 60) % 6
  const f = h / 60 - Math.floor(h / 60)
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  const cases: [number, number, number][] = [
    [v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q],
  ]
  return cases[i]!.map((x) => Math.round(x * 255)) as [number, number, number]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const v = max
  const s = max === 0 ? 0 : (max - min) / max
  let h = 0
  if (max !== min) {
    const d = max - min
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s * 100, v * 100]
}

function hexToHsv(hex: string): [number, number, number] {
  const rgb = hexToRgb(hex)
  if (!rgb) return [0, 100, 100]
  return rgbToHsv(...rgb)
}

function hsvToHex(h: number, s: number, v: number): string {
  return rgbToHex(...hsvToRgb(h, s, v))
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val))
}

// ── Component ───────────────────────────────────────────────────────────────

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  size?: 'sm' | 'md'
}

export function ColorPicker({ value, onChange, size = 'md' }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Internal HSV state — derived from prop initially
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value))
  const [hexInput, setHexInput] = useState(value)

  // Sync when external value changes (e.g. swatch click)
  useEffect(() => {
    const newHsv = hexToHsv(value)
    setHsv(newHsv)
    setHexInput(value)
  }, [value])

  const currentHex = hsvToHex(...hsv)

  // Emit on every HSV change
  const applyHsv = useCallback((newHsv: [number, number, number]) => {
    setHsv(newHsv)
    const hex = hsvToHex(...newHsv)
    setHexInput(hex)
    onChange(hex)
  }, [onChange])

  // ── Picker area (sat + val) ─────────────────────────────────────────────
  const pickerRef = useRef<HTMLDivElement>(null)
  const draggingPicker = useRef(false)

  const handlePickerPointer = useCallback((clientX: number, clientY: number) => {
    const el = pickerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clamp((clientX - rect.left) / rect.width, 0, 1)
    const y = clamp((clientY - rect.top) / rect.height, 0, 1)
    applyHsv([hsv[0], x * 100, (1 - y) * 100])
  }, [hsv, applyHsv])

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (draggingPicker.current) handlePickerPointer(e.clientX, e.clientY) }
    const onUp = () => { draggingPicker.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [handlePickerPointer])

  // ── Hue slider ─────────────────────────────────────────────────────────
  const hueRef = useRef<HTMLDivElement>(null)
  const draggingHue = useRef(false)

  const handleHuePointer = useCallback((clientX: number) => {
    const el = hueRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clamp((clientX - rect.left) / rect.width, 0, 1)
    applyHsv([x * 360, hsv[1], hsv[2]])
  }, [hsv, applyHsv])

  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (draggingHue.current) handleHuePointer(e.clientX) }
    const onUp = () => { draggingHue.current = false }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [handleHuePointer])

  // ── Hex input ──────────────────────────────────────────────────────────
  const handleHexInput = (raw: string) => {
    setHexInput(raw)
    const clean = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const newHsv = hexToHsv(clean)
      setHsv(newHsv)
      onChange(clean)
    }
  }

  // ── Open / close ───────────────────────────────────────────────────────
  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      // Flip upward if not enough space below
      const spaceBelow = window.innerHeight - rect.bottom
      const popupH = 360 // approximate
      const top = spaceBelow >= popupH
        ? rect.bottom + window.scrollY + 8
        : rect.top + window.scrollY - popupH - 8
      // Flip left if overflows right edge
      const popupW = 248
      const left = rect.left + popupW > window.innerWidth
        ? window.innerWidth - popupW - 8
        : rect.left
      setDropdownPos({ top, left })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
  }, [open])

  // ── Derived values for rendering ───────────────────────────────────────
  const [h, s, v] = hsv
  const hueColor = hsvToHex(h, 100, 100) // pure hue for gradient base
  const thumbX = `${s}%`
  const thumbY = `${100 - v}%`

  const circleSize = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'

  // ── Dropdown ───────────────────────────────────────────────────────────
  const dropdown = open
    ? createPortal(
        <div
          className="fixed z-[9999] w-[248px] overflow-hidden rounded-xl border"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
            boxShadow: 'var(--shadow-lg)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ── Gradient picker area ── */}
          <div
            ref={pickerRef}
            className="relative h-36 w-full cursor-crosshair select-none"
            style={{ backgroundColor: hueColor }}
            onPointerDown={(e) => {
              draggingPicker.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              handlePickerPointer(e.clientX, e.clientY)
            }}
          >
            {/* White → transparent */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(to right, #fff, transparent)' }}
            />
            {/* Transparent → black */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(to bottom, transparent, #000)' }}
            />
            {/* Thumb */}
            <div
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
              style={{
                left: thumbX,
                top: thumbY,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(0,0,0,0.1)',
                backgroundColor: currentHex,
              }}
            />
          </div>

          <div className="p-3">
            {/* ── Hue slider ── */}
            <div
              ref={hueRef}
              className="relative mb-3 h-3 w-full cursor-pointer select-none rounded-full"
              style={{
                background:
                  'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
              }}
              onPointerDown={(e) => {
                draggingHue.current = true
                e.currentTarget.setPointerCapture(e.pointerId)
                handleHuePointer(e.clientX)
              }}
            >
              {/* Hue thumb */}
              <div
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{
                  left: `${(h / 360) * 100}%`,
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                  backgroundColor: hueColor,
                }}
              />
            </div>

            {/* ── Preview + hex input ── */}
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <div
                className="h-8 w-8 flex-shrink-0 rounded-lg border"
                style={{ backgroundColor: currentHex, borderColor: 'var(--border-primary)' }}
              />
              <input
                value={hexInput}
                onChange={(e) => handleHexInput(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                maxLength={7}
                spellCheck={false}
                placeholder="#000000"
                className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs outline-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* ── Swatches ── */}
            <div
              className="border-t pt-3"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="grid grid-cols-5 gap-1.5">
                {LABEL_COLORS.map((color) => {
                  const active = value.toLowerCase() === color.toLowerCase()
                  return (
                    <button
                      key={color}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onChange(color)
                        setOpen(false)
                      }}
                      className="relative h-7 w-full rounded-md transition-transform hover:scale-110 focus:outline-none"
                      style={{
                        backgroundColor: color,
                        boxShadow: active ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${color}` : 'none',
                      }}
                      title={color}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`${circleSize} rounded-full border-2 transition-transform hover:scale-110 focus:outline-none`}
        style={{
          backgroundColor: value,
          borderColor: open ? value : 'transparent',
          boxShadow: open ? `0 0 0 2px var(--bg-primary), 0 0 0 4px ${value}` : 'none',
        }}
        title="Cambiar color"
      />
      {dropdown}
    </div>
  )
}
