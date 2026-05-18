import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  generatePKCE,
  generateOAuthState,
  buildGoogleOAuthUrl,
  fetchGoogleCalendarList,
  createGoogleCalendar,
  renameGoogleCalendar,
  deleteGoogleCalendar,
  setGoogleCalendarColor,
} from '@/services/calendarService'
import type { CalendarIntegration, GoogleCalendarListEntry } from '@/lib/types'
import { isTauri } from '@/lib/platform'

// D5: REDIRECT_URI is evaluated once at module load; the runtime environment
// never changes so a module-level constant is correct.
const REDIRECT_URI = isTauri()
  ? 'http://127.0.0.1:8765'
  : `${window.location.origin}${import.meta.env.BASE_URL}app/settings`

// ─── Query key factory ────────────────────────────────────────────────────────
const calendarKeys = {
  all: (userId: string) => ['calendarIntegrations', userId] as const,
}

// ─── Read integrations ────────────────────────────────────────────────────────
export function useCalendarIntegrations() {
  const { user } = useAuth()

  return useQuery<CalendarIntegration[]>({
    queryKey: calendarKeys.all(user?.id ?? ''),
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('user_id', user!.id)

      if (error) throw error
      return (data ?? []) as CalendarIntegration[]
    },
  })
}

// ─── Connect Google: generate PKCE + redirect ─────────────────────────────────

/** sessionStorage key for the per-attempt random OAuth state (CSRF). */
const OAUTH_STATE_KEY = 'oauth_state_google'

/** JS-side timeout (ms): slightly longer than the Rust 300 s budget so the
 *  promise always rejects if the Rust side never emits — prevents a forever-hang
 *  and ensures sessionStorage is always cleaned up. */
const DESKTOP_OAUTH_TIMEOUT_MS = 310_000

export function useConnectCalendar() {
  const exchangeMutation = useExchangeCalendarCode()

  const startOAuth = async () => {
    const { codeVerifier, codeChallenge } = await generatePKCE()
    const oauthState = generateOAuthState()

    sessionStorage.setItem('pkce_verifier_google', codeVerifier)
    sessionStorage.setItem(OAUTH_STATE_KEY, oauthState)

    const authUrl = buildGoogleOAuthUrl(codeChallenge, REDIRECT_URI, oauthState)

    if (isTauri()) {
      // D6 Desktop path: loopback server captures the code without a page reload.
      // Uses the event-based pattern (gotcha #4): emit "start-oauth-loopback",
      // listen once for "oauth-loopback-result". Events are allowed by default
      // via core:event:default — no ACL configuration needed.
      try {
        // Dynamic import keeps @tauri-apps/api out of the web bundle entirely.
        const { emit, once } = await import('@tauri-apps/api/event')

        const result = await new Promise<{ code: string; state: string }>((resolve, reject) => {
          // JS-side timeout: rejects if Rust never emits within the budget.
          const timeoutId = setTimeout(() => {
            sessionStorage.removeItem('pkce_verifier_google')
            sessionStorage.removeItem(OAUTH_STATE_KEY)
            reject(new Error('La conexión expiró. Volvé a intentarlo.'))
          }, DESKTOP_OAUTH_TIMEOUT_MS)

          once<{ code: string; state: string } | { error: string }>(
            'oauth-loopback-result',
            (event) => {
              clearTimeout(timeoutId)
              const payload = event.payload
              if ('error' in payload) {
                reject(new Error(payload.error))
              } else {
                resolve(payload)
              }
            },
          ).then(() => {
            // Listener registered; now trigger the Rust side.
            emit('start-oauth-loopback', { authUrl })
          })
        })

        // Validate CSRF state before exchanging the code.
        const storedState = sessionStorage.getItem(OAUTH_STATE_KEY)
        sessionStorage.removeItem(OAUTH_STATE_KEY)

        if (!storedState || result.state !== storedState) {
          sessionStorage.removeItem('pkce_verifier_google')
          toast.error('Error de seguridad: la respuesta OAuth no es válida.')
          return
        }

        await exchangeMutation.mutateAsync({ code: result.code })
      } catch (err: unknown) {
        sessionStorage.removeItem('pkce_verifier_google')
        sessionStorage.removeItem(OAUTH_STATE_KEY)
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Error al conectar Google Calendar'
        toast.error(message)
      }
      return
    }

    // Web path: full-page redirect; SettingsPage captures ?code= and validates state.
    window.location.href = authUrl
  }

  return { startOAuth }
}

// ─── Exchange code after OAuth callback ──────────────────────────────────────
export function useExchangeCalendarCode() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      const codeVerifier = sessionStorage.getItem('pkce_verifier_google')
      if (!codeVerifier)
        throw new Error('No se encontró el code_verifier. Intenta conectar de nuevo.')
      sessionStorage.removeItem('pkce_verifier_google')

      // Forzamos refresh para garantizar un token fresco tras el redirect OAuth
      const { data: refreshData } = await supabase.auth.refreshSession()
      const finalToken =
        refreshData.session?.access_token ??
        (await supabase.auth.getSession()).data.session?.access_token
      if (!finalToken) throw new Error('Sesión no disponible. Vuelve a iniciar sesión.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const response = await fetch(`${supabaseUrl}/functions/v1/calendar-oauth?action=exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${finalToken}`,
        },
        body: JSON.stringify({
          code,
          code_verifier: codeVerifier,
          redirect_uri: REDIRECT_URI,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error ?? 'Error al conectar Google Calendar')
      }

      return response.json() as Promise<{ success: boolean; email: string | null }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}

// ─── Disconnect ───────────────────────────────────────────────────────────────
export function useDisconnectCalendar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('calendar_integrations')
        .delete()
        .eq('user_id', user!.id)
        .eq('provider', 'google')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
      queryClient.removeQueries({ queryKey: ['calendarEvents'] })
    },
  })
}

// ─── List Google Calendars ────────────────────────────────────────────────────
export function useGoogleCalendarList(integration: CalendarIntegration | undefined) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const refreshMutation = useRefreshCalendarToken()

  return useQuery<GoogleCalendarListEntry[]>({
    queryKey: ['googleCalendarList', integration?.id],
    enabled: !!integration,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (!integration) return []

      const doRefresh = async () => {
        const result = await refreshMutation.mutateAsync()
        queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
        return result.access_token
      }

      let token = integration.access_token

      // Refresh proactivo si el token ya caducó o caduca en menos de 60 s
      const isExpired = new Date(integration.token_expiry) <= new Date(Date.now() + 60_000)
      if (isExpired) {
        try {
          token = await doRefresh()
        } catch {
          return []
        }
      }

      try {
        return await fetchGoogleCalendarList(token)
      } catch (err) {
        // Refresh reactivo: si el token estaba expirado en el servidor aunque no localmente
        if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
          try {
            token = await doRefresh()
            return await fetchGoogleCalendarList(token)
          } catch {
            return []
          }
        }
        return []
      }
    },
  })
}

// ─── Update selected calendar IDs ────────────────────────────────────────────
export function useUpdateCalendarSelection() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ selectedIds }: { selectedIds: string[] }) => {
      const { error } = await supabase
        .from('calendar_integrations')
        .update({ selected_calendar_ids: selectedIds })
        .eq('user_id', user!.id)
        .eq('provider', 'google')

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] })
    },
  })
}

// ─── Create Google Calendar ───────────────────────────────────────────────────
export function useCreateGoogleCalendar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      integration,
      name,
      backgroundColor,
    }: {
      integration: CalendarIntegration
      name: string
      backgroundColor?: string
    }) => createGoogleCalendar(integration.access_token, name, backgroundColor),
    onSuccess: (_data, { integration }) => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarList', integration.id] })
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}

// ─── Rename Google Calendar ───────────────────────────────────────────────────
export function useRenameGoogleCalendar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      integration,
      calendarId,
      name,
    }: {
      integration: CalendarIntegration
      calendarId: string
      name: string
    }) => renameGoogleCalendar(integration.access_token, calendarId, name),
    onSuccess: (_data, { integration }) => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarList', integration.id] })
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}

// ─── Set Google Calendar color ────────────────────────────────────────────────
export function useSetGoogleCalendarColor() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      integration,
      calendarId,
      backgroundColor,
    }: {
      integration: CalendarIntegration
      calendarId: string
      backgroundColor: string
    }) => setGoogleCalendarColor(integration.access_token, calendarId, backgroundColor),
    onSuccess: (_data, { integration }) => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarList', integration.id] })
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}

// ─── Delete Google Calendar ───────────────────────────────────────────────────
export function useDeleteGoogleCalendar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      integration,
      calendarId,
    }: {
      integration: CalendarIntegration
      calendarId: string
    }) => deleteGoogleCalendar(integration.access_token, calendarId),
    onSuccess: (_data, { integration }) => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendarList', integration.id] })
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}

// ─── Refresh access token ─────────────────────────────────────────────────────
let pendingRefresh: Promise<{ access_token: string; token_expiry: string }> | null = null

export function useRefreshCalendarToken() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ access_token: string; token_expiry: string }> => {
      if (pendingRefresh) return pendingRefresh

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

      const doRefresh = async () => {
        // Siempre forzamos un refreshSession() antes de llamar a la Edge Function
        // (verify_jwt: true). Así evitamos clock-skew y tokens cacheados expirados.
        // El overhead es mínimo (sólo ocurre ~cada hora cuando caduca el token de Google).
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        let authToken = refreshed?.session?.access_token

        if (refreshError || !authToken) {
          // Fallback: intentar con la sesión existente si refreshSession falla
          const {
            data: { session: fallback },
          } = await supabase.auth.getSession()
          authToken = fallback?.access_token
          if (!authToken) throw new Error('Sesión no disponible. Vuelve a iniciar sesión.')
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/calendar-oauth?action=refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({}),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Error desconocido' }))
          throw new Error(err.error ?? 'Error al renovar token')
        }

        return response.json() as Promise<{ access_token: string; token_expiry: string }>
      }

      pendingRefresh = doRefresh().finally(() => {
        pendingRefresh = null
      })

      return pendingRefresh
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.all(user?.id ?? '') })
    },
  })
}
