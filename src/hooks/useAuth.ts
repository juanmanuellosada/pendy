import { useCallback, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import type { Session } from '@supabase/supabase-js'

/* ── Shared auth session singleton ────────────────────── */

let currentSession: Session | null = null
let sessionLoading = true
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((l) => l())
}

// Bootstrap: read session once on module load
supabase.auth.getSession().then(({ data: { session } }) => {
  currentSession = session
  sessionLoading = false
  notify()
})

// Listen for changes (login, logout, token refresh)
supabase.auth.onAuthStateChange((_event, session) => {
  currentSession = session
  sessionLoading = false
  notify()
})

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSessionSnapshot() {
  return currentSession
}

function getLoadingSnapshot() {
  return sessionLoading
}

/* ── Profile query key ──────────────────────────────── */

export const profileKeys = {
  current: (userId: string) => ['profile', userId] as const,
}

/* ── Hook ──────────────────────────────────────────── */

export function useAuth() {
  const queryClient = useQueryClient()
  const session = useSyncExternalStore(subscribe, getSessionSnapshot)
  const loading = useSyncExternalStore(subscribe, getLoadingSnapshot)
  const user = session?.user ?? null

  const { data: profile = null } = useQuery<Profile | null>({
    queryKey: profileKeys.current(user?.id ?? ''),
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      return data
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}app` },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.clear()
  }, [queryClient])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/reset-password`,
    })
    if (error) throw error
  }, [])

  return {
    user,
    profile,
    session,
    loading: loading || (!!user && !profile),
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
  }
}
