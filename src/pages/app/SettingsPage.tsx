import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth, profileKeys } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useProjects } from '@/hooks/useProjects'
import { useExchangeCalendarCode } from '@/hooks/useCalendarIntegrations'
import { CalendarIntegrations } from '@/components/settings/CalendarIntegrations'
import { PushNotifications } from '@/components/settings/PushNotifications'
import { supabase } from '@/lib/supabase'
import { Moon, Sun, Monitor } from 'lucide-react'
import type { ThemeMode } from '@/styles/themes'
import type { Profile } from '@/lib/types'

function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current(user?.id ?? '') })
      toast.success('Configuración guardada')
    },
    onError: () => {
      toast.error('No se pudo guardar la configuración')
    },
  })
}

function SettingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-sm"
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function SettingsPage() {
  const { profile, session } = useAuth()
  const { mode, setTheme } = useTheme()
  const { data: projects = [] } = useProjects()
  const updateProfile = useUpdateProfile()
  const navigate = useNavigate()
  const exchangeCode = useExchangeCalendarCode()

  // Capturamos el code al montar y lo guardamos en estado
  const [pendingCode, setPendingCode] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const state = new URLSearchParams(window.location.search).get('state')
    return code && state === 'google' ? code : null
  })

  // Limpiamos la URL inmediatamente si hay un code
  useEffect(() => {
    if (pendingCode) {
      navigate('/app/settings', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esperamos a que la sesión esté lista antes de hacer el exchange
  useEffect(() => {
    if (pendingCode && session) {
      exchangeCode.mutate({ code: pendingCode })
      setPendingCode(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode, session])

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  const handleUpdate = (field: keyof Profile, value: string | number | null) => {
    updateProfile.mutate({ [field]: value } as Partial<Profile>)
  }

  const activeProjects = projects.filter((p) => !p.is_archived)

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Configuración
      </h1>

      <div className="space-y-6">
        {/* Profile section */}
        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Perfil
          </h2>
          <div className="mt-3 space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Nombre:
              </span>{' '}
              {profile?.full_name || 'Sin nombre'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Email:
              </span>{' '}
              {profile?.email}
            </p>
          </div>
        </section>

        {/* Theme section */}
        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Tema
          </h2>
          <div className="mt-3 flex gap-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors"
                style={{
                  borderColor: mode === value ? '#283B56' : 'var(--border-primary)',
                  backgroundColor: mode === value ? '#283B56' : 'transparent',
                  color: mode === value ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* General preferences */}
        <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            General
          </h2>
          <div className="space-y-4">
            <SettingSelect
              label="Idioma"
              value={profile?.language ?? 'es'}
              options={[
                { value: 'es', label: 'Español' },
                { value: 'en', label: 'English' },
              ]}
              onChange={(v) => handleUpdate('language', v)}
            />

            <SettingSelect
              label="Zona horaria"
              value={profile?.timezone ?? 'America/Argentina/Buenos_Aires'}
              options={[
                { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
                { value: 'America/New_York', label: 'Nueva York (GMT-5)' },
                { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
                { value: 'America/Denver', label: 'Denver (GMT-7)' },
                { value: 'America/Los_Angeles', label: 'Los Ángeles (GMT-8)' },
                { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
                { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
                { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
                { value: 'America/Lima', label: 'Lima (GMT-5)' },
                { value: 'America/Santiago', label: 'Santiago (GMT-4)' },
                { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
                { value: 'Europe/London', label: 'Londres (GMT+0)' },
                { value: 'UTC', label: 'UTC' },
              ]}
              onChange={(v) => handleUpdate('timezone', v)}
            />

            <SettingSelect
              label="Formato de fecha"
              value={profile?.date_format ?? 'DD/MM/YYYY'}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD/MM/AAAA' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/AAAA' },
                { value: 'YYYY-MM-DD', label: 'AAAA-MM-DD' },
              ]}
              onChange={(v) => handleUpdate('date_format', v)}
            />

            <SettingSelect
              label="Formato de hora"
              value={profile?.time_format ?? '24h'}
              options={[
                { value: '24h', label: '24 horas' },
                { value: '12h', label: '12 horas (AM/PM)' },
              ]}
              onChange={(v) => handleUpdate('time_format', v)}
            />

            <SettingSelect
              label="Inicio de semana"
              value={String(profile?.start_of_week ?? 1)}
              options={[
                { value: '1', label: 'Lunes' },
                { value: '0', label: 'Domingo' },
                { value: '6', label: 'Sábado' },
              ]}
              onChange={(v) => handleUpdate('start_of_week', Number(v))}
            />

            <SettingSelect
              label="Vista por defecto"
              value={profile?.default_view ?? 'today'}
              options={[
                { value: 'inbox', label: 'Bandeja de entrada' },
                { value: 'today', label: 'Hoy' },
                { value: 'upcoming', label: 'Próximos' },
              ]}
              onChange={(v) => handleUpdate('default_view', v)}
            />

            <SettingSelect
              label="Proyecto por defecto (añadir rápido)"
              value={profile?.quick_add_default_project ?? ''}
              options={[
                { value: '', label: 'Bandeja de entrada' },
                ...activeProjects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              onChange={(v) => handleUpdate('quick_add_default_project', v || null)}
            />
          </div>
        </section>

        {/* Push notifications section */}
        <PushNotifications />

        {/* Calendar integrations section */}
        <CalendarIntegrations
          isConnecting={exchangeCode.isPending}
          connectError={
            exchangeCode.isError
              ? exchangeCode.error instanceof Error
                ? exchangeCode.error.message
                : 'Error al conectar el calendario'
              : null
          }
        />
      </div>
    </div>
  )
}
