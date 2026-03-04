import { CalendarDays, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { CalendarEvent } from '@/lib/types'
import { CalendarEventTooltip, getEventColor, getCalendarName } from './CalendarEventTooltip'

interface CalendarEventItemProps {
  event: CalendarEvent
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) return 'Todo el día'
  const startStr = format(event.start, 'HH:mm', { locale: es })
  const endStr = format(event.end, 'HH:mm', { locale: es })
  return `${startStr} – ${endStr}`
}

export function CalendarEventItem({ event }: CalendarEventItemProps) {
  const color = getEventColor(event)
  const calendarName = getCalendarName(event)
  const timeStr = formatEventTime(event)

  const inner = (
    <div
      className="group flex items-start gap-3 px-3 py-2.5 transition-colors"
      style={{
        borderLeft: `3px solid ${color}`,
        backgroundColor: `${color}0D`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = `${color}18`)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = `${color}0D`)}
    >
      {/* Calendar icon badge */}
      <div
        className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${color}25`, color }}
      >
        <CalendarDays size={13} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Badge row: "Evento" pill + calendar name */}
        <div className="mb-1 flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${color}20`, color }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            Evento
          </span>
          <span className="truncate text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {calendarName}
          </span>
        </div>

        {/* Title */}
        <p className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {event.title}
        </p>

        {/* Time + location */}
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {timeStr}
          </span>
          {event.location && (
            <span className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              · {event.location}
            </span>
          )}
        </div>
      </div>

      {/* External link icon (visible on hover) */}
      {event.htmlLink && (
        <div className="mt-0.5 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-60">
          <ExternalLink size={13} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}
    </div>
  )

  if (event.htmlLink) {
    return (
      <CalendarEventTooltip event={event}>
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {inner}
        </a>
      </CalendarEventTooltip>
    )
  }

  return (
    <CalendarEventTooltip event={event}>
      <div>{inner}</div>
    </CalendarEventTooltip>
  )
}
