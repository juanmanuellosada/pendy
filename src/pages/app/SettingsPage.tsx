import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useExchangeCalendarCode } from '@/hooks/useCalendarIntegrations'
import { CalendarIntegrations } from '@/components/settings/CalendarIntegrations'
import { PushNotifications } from '@/components/settings/PushNotifications'
import { Moon, Sun, Monitor } from 'lucide-react'
import type { ThemeMode } from '@/styles/themes'

export default function SettingsPage() {
  const { profile, session } = useAuth()
  const { mode, setTheme } = useTheme()
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
