import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun, Monitor } from 'lucide-react'
import type { ThemeMode } from '@/styles/themes'

export default function SettingsPage() {
  const { profile } = useAuth()
  const { mode, setTheme } = useTheme()

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Configuraci\u00f3n
      </h1>

      <div className="space-y-6">
        {/* Profile section */}
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Perfil
          </h2>
          <div className="mt-3 space-y-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Nombre:</span>{' '}
              {profile?.full_name || 'Sin nombre'}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Email:</span>{' '}
              {profile?.email}
            </p>
          </div>
        </section>

        {/* Theme section */}
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
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
      </div>
    </div>
  )
}
