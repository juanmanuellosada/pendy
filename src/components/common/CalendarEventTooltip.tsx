import { useState, useRef, useEffect, cloneElement, isValidElement } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, MapPin, AlignLeft, ExternalLink, Repeat } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarEvent } from '@/lib/types'

const PROVIDER_COLORS: Record<CalendarEvent['provider'], string> = {
  google: '#4285F4',
}

const PROVIDER_LABELS: Record<CalendarEvent['provider'], string> = {
  google: 'Google Calendar',
}

export function getEventColor(event: CalendarEvent): string {
  return event.calendarColor ?? PROVIDER_COLORS[event.provider]
}

export function getCalendarName(event: CalendarEvent): string {
  return event.calendarName ?? PROVIDER_LABELS[event.provider]
}

interface CalendarEventTooltipProps {
  event: CalendarEvent
  children: React.ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
  }>
  disabled?: boolean
}

export function CalendarEventTooltip({ event, children, disabled }: CalendarEventTooltipProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number; w: number }>({ x: 0, y: 0, w: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const color = getEventColor(event)
  const calendarName = getCalendarName(event)

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

  useEffect(() => {
    if (disabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setShow(false)
    }
  }, [disabled])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!show || !tooltipRef.current) return
    const tt = tooltipRef.current
    const rect = tt.getBoundingClientRect()
    const vh = window.innerHeight

    let left = pos.x - rect.width - 8
    if (left < 8) left = pos.x + pos.w + 8

    let top = pos.y
    if (top + rect.height > vh - 8) top = vh - rect.height - 8
    if (top < 8) top = 8

    tt.style.left = `${left}px`
    tt.style.top = `${top}px`
  }, [show, pos])

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
      })
    : children

  return (
    <>
      {child}
      {show &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[100] w-72 rounded-xl border p-3.5 shadow-2xl pointer-events-none animate-fade-in"
            style={{
              backgroundColor: 'var(--bg-primary)',
              borderColor: 'var(--border-primary)',
              borderLeftWidth: 3,
              borderLeftColor: color,
              left: -9999,
              top: -9999,
            }}
          >
            {/* Header */}
            <div className="mb-2.5 flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center rounded"
                style={{ backgroundColor: `${color}25`, color }}
              >
                <CalendarDays size={12} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                Evento de calendario
              </span>
            </div>

            {/* Title */}
            <p
              className="text-sm font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {event.title}
            </p>

            <div className="mt-2.5 space-y-1.5">
              {/* Calendar name */}
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {calendarName}
                </span>
              </div>

              {/* Time */}
              <div className="flex items-start gap-2">
                <Clock
                  size={13}
                  className="mt-px flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {event.isAllDay
                    ? `Todo el día · ${format(event.start, "d 'de' MMMM", { locale: es })}`
                    : `${format(event.start, "EEEE d 'de' MMMM", { locale: es })}, ${format(event.start, 'HH:mm')} – ${format(event.end, 'HH:mm')}`}
                </span>
              </div>

              {/* Location */}
              {event.location && (
                <div className="flex items-start gap-2">
                  <MapPin
                    size={13}
                    className="mt-px flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {event.location}
                  </span>
                </div>
              )}

              {/* Recurrencia */}
              {event.recurrenceText && (
                <div className="flex items-start gap-2">
                  <Repeat
                    size={13}
                    className="mt-px flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {event.recurrenceText}
                  </span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="flex items-start gap-2">
                  <AlignLeft
                    size={13}
                    className="mt-px flex-shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <p
                    className="line-clamp-3 text-xs leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* Link footer */}
            {event.htmlLink && (
              <div
                className="mt-3 border-t pt-2.5"
                style={{ borderColor: 'var(--border-secondary)' }}
              >
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
                  <ExternalLink size={12} />
                  Abrir en Google Calendar
                </span>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
