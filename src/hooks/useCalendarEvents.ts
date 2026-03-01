import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { startOfDay, endOfDay, addDays } from 'date-fns'
import {
  fetchGoogleEvents,
  fetchGoogleCalendarList,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  moveGoogleEvent,
} from '@/services/calendarService'
import { useCalendarIntegrations, useRefreshCalendarToken } from './useCalendarIntegrations'
import { useAuth } from './useAuth'
import type {
  CalendarEvent,
  CalendarEventReminder,
  CalendarIntegration,
  GoogleCalendarListEntry,
} from '@/lib/types'

function isTokenExpired(integration: CalendarIntegration): boolean {
  return new Date(integration.token_expiry) <= new Date(Date.now() + 60_000)
}

// ─── Google events with auto-refresh ─────────────────────────────────────────

async function fetchGoogleEventsWithRefresh(
  integration: CalendarIntegration,
  from: Date,
  to: Date,
  refreshFn: () => Promise<{ access_token: string }>,
): Promise<CalendarEvent[]> {
  let { access_token } = integration

  if (isTokenExpired(integration)) {
    try {
      const refreshed = await refreshFn()
      access_token = refreshed.access_token
    } catch {
      return []
    }
  }

  const calendarIds =
    integration.selected_calendar_ids?.length > 0
      ? integration.selected_calendar_ids
      : ['primary']

  const fetchAll = async (token: string) => {
    let calendarList: GoogleCalendarListEntry[] = []
    try {
      calendarList = await fetchGoogleCalendarList(token)
    } catch {
      // ignore — events will render without calendar metadata
    }

    const results = await Promise.all(
      calendarIds.map((id) => {
        const meta =
          id === 'primary'
            ? calendarList.find((c) => c.primary)
            : calendarList.find((c) => c.id === id)
        return fetchGoogleEvents(token, from, to, id, {
          calendarName: meta?.summary,
          calendarColor: meta?.backgroundColor,
        }).catch(() => [] as CalendarEvent[])
      }),
    )
    const flat = results.flat()
    const seen = new Set<string>()
    return flat.filter((ev) => {
      if (seen.has(ev.id)) return false
      seen.add(ev.id)
      return true
    })
  }

  try {
    return await fetchAll(access_token)
  } catch (err) {
    if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
      try {
        const refreshed = await refreshFn()
        return await fetchAll(refreshed.access_token)
      } catch {
        return []
      }
    }
    return []
  }
}

// ─── Today's events ───────────────────────────────────────────────────────────

export function useTodayCalendarEvents() {
  const { user } = useAuth()
  const { data: integrations = [] } = useCalendarIntegrations()
  const refreshMutation = useRefreshCalendarToken()
  const queryClient = useQueryClient()

  const googleIntegration = integrations.find((i) => i.provider === 'google' && i.is_active)

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendarEvents', 'today', user?.id],
    enabled: !!user && !!googleIntegration,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const from = startOfDay(new Date())
      const to = endOfDay(new Date())

      const makeRefreshFn = async () => {
        const result = await refreshMutation.mutateAsync()
        queryClient.invalidateQueries({ queryKey: ['calendarIntegrations', user?.id] })
        return result
      }

      if (!googleIntegration) return []
      const events = await fetchGoogleEventsWithRefresh(googleIntegration, from, to, makeRefreshFn)

      return events.sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1
        if (!a.isAllDay && b.isAllDay) return 1
        return a.start.getTime() - b.start.getTime()
      })
    },
  })
}

// ─── Upcoming events (N days) ─────────────────────────────────────────────────

export function useUpcomingCalendarEvents(days: number) {
  const { user } = useAuth()
  const { data: integrations = [] } = useCalendarIntegrations()
  const refreshMutation = useRefreshCalendarToken()
  const queryClient = useQueryClient()

  const googleIntegration = integrations.find((i) => i.provider === 'google' && i.is_active)

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendarEvents', 'upcoming', user?.id, days],
    enabled: !!user && !!googleIntegration,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const today = startOfDay(new Date())
      const from = today
      const to = endOfDay(addDays(today, days - 1))

      const makeRefreshFn = async () => {
        const result = await refreshMutation.mutateAsync()
        queryClient.invalidateQueries({ queryKey: ['calendarIntegrations', user?.id] })
        return result
      }

      if (!googleIntegration) return []
      const events = await fetchGoogleEventsWithRefresh(googleIntegration, from, to, makeRefreshFn)
      return events.sort((a, b) => a.start.getTime() - b.start.getTime())
    },
  })
}

// ─── Events for arbitrary date range (for CalendarView) ───────────────────────

export function useCalendarEventsByRange(from: Date | null, to: Date | null) {
  const { user } = useAuth()
  const { data: integrations = [] } = useCalendarIntegrations()
  const refreshMutation = useRefreshCalendarToken()
  const queryClient = useQueryClient()

  const googleIntegration = integrations.find((i) => i.provider === 'google' && i.is_active)
  const fromKey = from ? from.toISOString().slice(0, 10) : ''
  const toKey = to ? to.toISOString().slice(0, 10) : ''

  return useQuery<CalendarEvent[]>({
    queryKey: ['calendarEvents', 'range', user?.id, fromKey, toKey],
    enabled: !!user && !!googleIntegration && !!from && !!to,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const makeRefreshFn = async () => {
        const result = await refreshMutation.mutateAsync()
        queryClient.invalidateQueries({ queryKey: ['calendarIntegrations', user?.id] })
        return result
      }

      if (!googleIntegration) return []
      const events = await fetchGoogleEventsWithRefresh(googleIntegration, from!, to!, makeRefreshFn)
      return events.sort((a, b) => a.start.getTime() - b.start.getTime())
    },
  })
}

// ─── Calendar event mutations (create / update / delete) ─────────────────────

export function useCalendarEventMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: integrations = [] } = useCalendarIntegrations()
  const refreshMutation = useRefreshCalendarToken()

  const getValidToken = async (): Promise<string> => {
    const integration = integrations.find((i) => i.provider === 'google' && i.is_active)
    if (!integration) throw new Error('No hay integración de Google Calendar activa')
    if (new Date(integration.token_expiry) <= new Date(Date.now() + 60_000)) {
      const refreshed = await refreshMutation.mutateAsync()
      queryClient.invalidateQueries({ queryKey: ['calendarIntegrations', user?.id] })
      return refreshed.access_token
    }
    return integration.access_token
  }

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
  }

  const createEvent = useMutation({
    mutationFn: async (data: {
      calendarId: string
      title: string
      start: Date
      end: Date
      isAllDay?: boolean
      description?: string
      location?: string
      recurrence?: string[]
      reminders?: CalendarEventReminder[]
    }) => {
      const token = await getValidToken()
      return createGoogleEvent(token, data.calendarId, data)
    },
    onSuccess: invalidateEvents,
  })

  const updateEvent = useMutation({
    mutationFn: async (data: {
      eventId: string
      calendarId: string
      title?: string
      start?: Date
      end?: Date
      isAllDay?: boolean
      description?: string
      location?: string
      recurrence?: string[]
      reminders?: CalendarEventReminder[]
    }) => {
      const { eventId, calendarId, ...updates } = data
      const rawId = eventId.replace(/^google:/, '')
      const token = await getValidToken()
      return updateGoogleEvent(token, calendarId, rawId, updates)
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['calendarEvents'] })
      const snapshots = queryClient.getQueriesData<CalendarEvent[]>({ queryKey: ['calendarEvents'] })
      queryClient.setQueriesData<CalendarEvent[]>({ queryKey: ['calendarEvents'] }, (old) => {
        if (!old) return old
        return old.map((ev) => {
          if (ev.id !== data.eventId) return ev
          return {
            ...ev,
            ...(data.start !== undefined && { start: data.start }),
            ...(data.end !== undefined && { end: data.end }),
            ...(data.title !== undefined && { title: data.title }),
            ...(data.isAllDay !== undefined && { isAllDay: data.isAllDay }),
          }
        })
      })
      return { snapshots }
    },
    onError: (_err, _data, context) => {
      context?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value))
      invalidateEvents()
    },
    onSuccess: invalidateEvents,
  })

  const deleteEvent = useMutation({
    mutationFn: async (data: { eventId: string; calendarId: string }) => {
      const rawId = data.eventId.replace(/^google:/, '')
      const token = await getValidToken()
      return deleteGoogleEvent(token, data.calendarId, rawId)
    },
    onSuccess: invalidateEvents,
  })

  const moveEvent = useMutation({
    mutationFn: async (data: {
      eventId: string
      fromCalendarId: string
      toCalendarId: string
    }) => {
      const rawId = data.eventId.replace(/^google:/, '')
      const token = await getValidToken()
      return moveGoogleEvent(token, data.fromCalendarId, rawId, data.toCalendarId)
    },
    onSuccess: invalidateEvents,
  })

  return { createEvent, updateEvent, deleteEvent, moveEvent }
}
