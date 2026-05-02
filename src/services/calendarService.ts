import { supabase } from '@/lib/supabase'
import type { CalendarEvent, CalendarEventReminder, GoogleCalendarListEntry } from '@/lib/types'

// ─── Sync status helper ───────────────────────────────────────────────────────

/** Actualiza los campos de metadata de sincronización en calendar_integrations.
 *  Fire-and-forget: no lanza, solo loggea errores para no bloquear el render. */
export function updateSyncStatus(
  integrationId: string,
  status: 'ok' | 'token_expired' | 'error',
  errorMessage?: string,
): void {
  supabase
    .from('calendar_integrations')
    .update({
      sync_status: status,
      last_sync_error: errorMessage ?? null,
      ...(status === 'ok' ? { last_synced_at: new Date().toISOString() } : {}),
    })
    .eq('id', integrationId)
    .then(({ error }) => {
      if (error) console.error('[calendarService] updateSyncStatus error:', error)
    })
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const codeVerifier = base64UrlEncode(array.buffer)

  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = base64UrlEncode(digest)

  return { codeVerifier, codeChallenge }
}

// ─── OAuth URL builder ────────────────────────────────────────────────────────

export function buildGoogleOAuthUrl(codeChallenge: string, redirectUri: string): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope:
      'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: 'google',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// ─── RRULE → texto legible en español ────────────────────────────────────────

const BYDAY_ES: Record<string, string> = {
  MO: 'lunes',
  TU: 'martes',
  WE: 'miércoles',
  TH: 'jueves',
  FR: 'viernes',
  SA: 'sábado',
  SU: 'domingo',
}

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function formatUntilDate(until: string): string {
  // Formato RRULE: YYYYMMDDTHHMMSSZ  o  YYYYMMDD
  const year = parseInt(until.slice(0, 4), 10)
  const month = parseInt(until.slice(4, 6), 10) - 1
  const day = parseInt(until.slice(6, 8), 10)
  return `${day} de ${MONTH_NAMES_ES[month] ?? '?'} de ${year}`
}

function listDays(byday: string): string {
  // Eliminar modificadores numéricos como +1, -1 (e.g. "1MO" → "MO")
  const names = byday.split(',').map((d) => BYDAY_ES[d.replace(/^[+-]?\d+/, '')] ?? d)
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function parseRRule(rruleLine: string): string {
  const rule = rruleLine.replace(/^RRULE:/i, '')
  const parts: Record<string, string> = {}
  for (const part of rule.split(';')) {
    const eq = part.indexOf('=')
    if (eq >= 0) parts[part.slice(0, eq)] = part.slice(eq + 1)
  }

  const freq = parts['FREQ'] ?? ''
  const interval = parseInt(parts['INTERVAL'] ?? '1', 10)
  const byday = parts['BYDAY'] ?? ''
  const bymonthday = parts['BYMONTHDAY'] ?? ''
  const bysetpos = parts['BYSETPOS'] ?? ''
  const until = parts['UNTIL'] ?? ''
  const count = parts['COUNT'] ?? ''

  let text = ''

  switch (freq) {
    case 'DAILY':
      text = interval === 1 ? 'Cada día' : `Cada ${interval} días`
      break

    case 'WEEKLY': {
      text = interval === 1 ? 'Cada semana' : `Cada ${interval} semanas`
      if (byday) text += `, el ${listDays(byday)}`
      break
    }

    case 'MONTHLY': {
      text = interval === 1 ? 'Cada mes' : `Cada ${interval} meses`
      if (bysetpos && byday) {
        const pos = parseInt(bysetpos, 10)
        const posLabel =
          pos === 1
            ? 'primer'
            : pos === 2
              ? 'segundo'
              : pos === 3
                ? 'tercer'
                : pos === 4
                  ? 'cuarto'
                  : pos === -1
                    ? 'último'
                    : `${pos}º`
        text += `, el ${posLabel} ${listDays(byday)}`
      } else if (bymonthday) {
        text += `, el día ${bymonthday}`
      }
      break
    }

    case 'YEARLY':
      text = interval === 1 ? 'Cada año' : `Cada ${interval} años`
      break

    default:
      return ''
  }

  if (until) {
    text += `, hasta el ${formatUntilDate(until)}`
  } else if (count) {
    const n = parseInt(count, 10)
    text += `, ${n} ${n === 1 ? 'vez' : 'veces'}`
  }

  return text
}

// ─── Normalize raw API response to CalendarEvent ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGoogleEvent(
  raw: any,
  meta?: { calendarId?: string; calendarName?: string; calendarColor?: string },
): CalendarEvent {
  const isAllDay = !!raw.start?.date
  const start = isAllDay ? new Date(`${raw.start.date}T00:00:00`) : new Date(raw.start.dateTime)
  const end = isAllDay ? new Date(`${raw.end.date}T00:00:00`) : new Date(raw.end.dateTime)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reminders: CalendarEventReminder[] | undefined =
    raw.reminders?.useDefault === false
      ? ((raw.reminders?.overrides ?? []) as CalendarEventReminder[])
      : undefined

  return {
    id: `google:${raw.id}`,
    provider: 'google',
    title: raw.summary ?? '(Sin título)',
    start,
    end,
    isAllDay,
    location: raw.location,
    description: raw.description,
    htmlLink: raw.htmlLink,
    calendarId: meta?.calendarId,
    calendarName: meta?.calendarName,
    calendarColor: meta?.calendarColor,
    recurringEventId: raw.recurringEventId,
    recurrence: raw.recurrence,
    reminders,
  }
}

// ─── Fetch calendar list ──────────────────────────────────────────────────────

export async function fetchGoogleCalendarList(
  accessToken: string,
): Promise<GoogleCalendarListEntry[]> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  const data = await response.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map(
    (item: any): GoogleCalendarListEntry => ({
      id: item.id,
      summary: item.summary ?? item.id,
      backgroundColor: item.backgroundColor,
      primary: item.primary ?? false,
      accessRole: item.accessRole,
    }),
  )
}

// ─── Create calendar ──────────────────────────────────────────────────────────

export async function createGoogleCalendar(
  accessToken: string,
  name: string,
  backgroundColor?: string,
): Promise<GoogleCalendarListEntry> {
  const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: name }),
  })
  if (!createRes.ok) throw new Error('Error al crear el calendario')
  const created = await createRes.json()
  const calendarId: string = created.id

  if (backgroundColor) {
    await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ backgroundColor, foregroundColor: '#ffffff' }),
      },
    )
  }

  return { id: calendarId, summary: name, backgroundColor, primary: false, accessRole: 'owner' }
}

// ─── Rename calendar ─────────────────────────────────────────────────────────

export async function renameGoogleCalendar(
  accessToken: string,
  calendarId: string,
  name: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: name }),
    },
  )
  if (!res.ok) throw new Error('Error al renombrar el calendario')
}

// ─── Set calendar color ───────────────────────────────────────────────────────

export async function setGoogleCalendarColor(
  accessToken: string,
  calendarId: string,
  backgroundColor: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ backgroundColor, foregroundColor: '#ffffff' }),
    },
  )
  if (!res.ok) throw new Error('Error al cambiar el color')
}

// ─── Delete calendar ─────────────────────────────────────────────────────────

export async function deleteGoogleCalendar(accessToken: string, calendarId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok && res.status !== 204) throw new Error('Error al eliminar el calendario')
}

// ─── Fetch recurrence text for recurring event master IDs ─────────────────────

async function fetchRecurrenceMap(
  accessToken: string,
  encodedCalendarId: string,
  masterIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  await Promise.all(
    masterIds.map(async (masterId) => {
      try {
        const resp = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(masterId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )
        if (!resp.ok) return
        const master = await resp.json()
        const rruleLine: string | undefined = (master.recurrence ?? []).find((r: string) =>
          r.startsWith('RRULE:'),
        )
        if (rruleLine) {
          const text = parseRRule(rruleLine)
          if (text) map.set(masterId, text)
        }
      } catch {
        // ignorar errores individuales
      }
    }),
  )

  return map
}

// ─── Fetch events ─────────────────────────────────────────────────────────────

export async function fetchGoogleEvents(
  accessToken: string,
  from: Date,
  to: Date,
  calendarId = 'primary',
  calendarMeta?: { calendarName?: string; calendarColor?: string },
): Promise<CalendarEvent[]> {
  const encodedId = encodeURIComponent(calendarId)
  const baseParams = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = []
  let pageToken: string | undefined
  const MAX_PAGES = 10 // safety cap — 2500 events per range should never be hit in practice

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams(baseParams)
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )

    if (!response.ok) {
      if (response.status === 401) throw new Error('TOKEN_EXPIRED')
      throw new Error(`Google Calendar API error: ${response.status}`)
    }

    const data = await response.json()
    allItems.push(...(data.items ?? []))

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let events: CalendarEvent[] = allItems.map((item: any) =>
    normalizeGoogleEvent(item, { calendarId, ...calendarMeta }),
  )

  // Enriquecer instancias recurrentes con texto de recurrencia del evento master
  const uniqueMasterIds: string[] = [
    ...new Set(events.filter((e) => e.recurringEventId).map((e) => e.recurringEventId as string)),
  ]

  if (uniqueMasterIds.length > 0) {
    const recurrenceMap = await fetchRecurrenceMap(accessToken, encodedId, uniqueMasterIds)
    if (recurrenceMap.size > 0) {
      events = events.map((event) => {
        if (event.recurringEventId) {
          const text = recurrenceMap.get(event.recurringEventId)
          if (text) return { ...event, recurrenceText: text }
        }
        return event
      })
    }
  }

  return events
}

// ─── Write helpers ────────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toGoogleDateTime(date: Date, isAllDay: boolean) {
  if (isAllDay) return { date: toDateString(date) }
  return { dateTime: date.toISOString(), timeZone: 'America/Argentina/Buenos_Aires' }
}

// ─── Create event ─────────────────────────────────────────────────────────────

export async function createGoogleEvent(
  accessToken: string,
  calendarId: string,
  data: {
    title: string
    start: Date
    end: Date
    isAllDay?: boolean
    description?: string
    location?: string
    recurrence?: string[]
    reminders?: CalendarEventReminder[]
  },
): Promise<CalendarEvent> {
  const isAllDay = data.isAllDay ?? false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    summary: data.title,
    description: data.description ?? undefined,
    location: data.location ?? undefined,
    start: toGoogleDateTime(data.start, isAllDay),
    end: toGoogleDateTime(data.end, isAllDay),
  }
  if (data.recurrence !== undefined) body.recurrence = data.recurrence
  if (data.reminders !== undefined) {
    body.reminders =
      data.reminders.length > 0
        ? { useDefault: false, overrides: data.reminders }
        : { useDefault: true }
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    if (response.status === 403) throw new Error('PERMISSION_DENIED')
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  const raw = await response.json()
  return normalizeGoogleEvent(raw, { calendarId })
}

// ─── Update event ─────────────────────────────────────────────────────────────

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  data: {
    title?: string
    start?: Date
    end?: Date
    isAllDay?: boolean
    description?: string
    location?: string
    recurrence?: string[]
    reminders?: CalendarEventReminder[]
  },
): Promise<CalendarEvent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {}
  if (data.title !== undefined) body.summary = data.title
  if (data.description !== undefined) body.description = data.description
  if (data.location !== undefined) body.location = data.location
  const isAllDay = data.isAllDay ?? false
  if (data.start !== undefined) body.start = toGoogleDateTime(data.start, isAllDay)
  if (data.end !== undefined) body.end = toGoogleDateTime(data.end, isAllDay)
  if (data.recurrence !== undefined) body.recurrence = data.recurrence
  if (data.reminders !== undefined) {
    body.reminders =
      data.reminders.length > 0
        ? { useDefault: false, overrides: data.reminders }
        : { useDefault: true }
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    if (response.status === 403) throw new Error('PERMISSION_DENIED')
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  const raw = await response.json()
  return normalizeGoogleEvent(raw, { calendarId })
}

// ─── Delete event ─────────────────────────────────────────────────────────────

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    if (response.status === 403) throw new Error('PERMISSION_DENIED')
    // 410 = already deleted — no problem
    if (response.status !== 410) throw new Error(`Google Calendar API error: ${response.status}`)
  }
}

// ─── Move event to another calendar ──────────────────────────────────────────

export async function moveGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  targetCalendarId: string,
): Promise<CalendarEvent> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}/move?destination=${encodeURIComponent(targetCalendarId)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    throw new Error(`Google Calendar API error: ${response.status}`)
  }

  const raw = await response.json()
  return normalizeGoogleEvent(raw, { calendarId: targetCalendarId })
}
