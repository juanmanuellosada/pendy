import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth, profileKeys } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useProjects } from '@/hooks/useProjects'
import { useExchangeCalendarCode } from '@/hooks/useCalendarIntegrations'
import { CalendarIntegrations } from '@/components/settings/CalendarIntegrations'
import { PushNotifications } from '@/components/settings/PushNotifications'
import { InstallOptions } from '@/components/settings/InstallOptions'
import { supabase } from '@/lib/supabase'
import { Moon, Sun, Monitor, Pencil, Check, X } from 'lucide-react'
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

function ProfileSection({
  profile,
  onUpdateName,
}: {
  profile: Profile | null
  onUpdateName: (name: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(profile?.full_name ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  const handleSaveName = () => {
    if (name.trim()) {
      onUpdateName(name.trim())
    }
    setEditingName(false)
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }
    setPasswordLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) {
      toast.error('No se pudo cambiar la contraseña')
    } else {
      toast.success('Contraseña actualizada')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Perfil
      </h2>
      <div className="mt-3 space-y-3">
        {/* Name */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Nombre:
          </span>
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                className="rounded-md border px-2 py-1 text-sm"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button onClick={handleSaveName} className="p-1 text-green-500">
                <Check size={14} />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="p-1"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {profile?.full_name || 'Sin nombre'}
              </span>
              <button
                onClick={() => {
                  setName(profile?.full_name ?? '')
                  setEditingName(true)
                }}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Editar nombre"
              >
                <Pencil size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Email (read-only) */}
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            Email:
          </span>{' '}
          {profile?.email}
        </p>

        {/* Change password */}
        <details className="group">
          <summary
            className="cursor-pointer text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            Cambiar contraseña
          </summary>
          <div className="mt-2 space-y-2 pl-1">
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full max-w-xs rounded-md border px-3 py-1.5 text-sm"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full max-w-xs rounded-md border px-3 py-1.5 text-sm"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={handleChangePassword}
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {passwordLoading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </div>
        </details>
      </div>
    </section>
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
        <ProfileSection
          profile={profile}
          onUpdateName={(name) => handleUpdate('full_name', name)}
        />

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
                  borderColor: mode === value ? 'var(--color-primary)' : 'var(--border-primary)',
                  backgroundColor: mode === value ? 'var(--color-primary)' : 'transparent',
                  color: mode === value ? '#FFFFFF' : 'var(--text-primary)',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Install options section */}
        <InstallOptions />

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
