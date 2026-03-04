import { Bell, BellOff } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export function PushNotifications() {
  const { supported, enabled, permission, enable, disable } = usePushNotifications()

  if (!supported) return null

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Notificaciones push
      </h2>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {enabled
              ? 'Recibirás recordatorios de tus tareas en este navegador.'
              : 'Activa las notificaciones para recibir recordatorios de tus tareas.'}
          </p>
          {permission === 'denied' && !enabled && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-accent)' }}>
              Los permisos están bloqueados. Habilítalos desde la configuración del navegador.
            </p>
          )}
        </div>

        <button
          onClick={enabled ? disable : enable}
          disabled={permission === 'denied' && !enabled}
          className="ml-4 flex flex-shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            backgroundColor: enabled ? 'var(--bg-secondary)' : 'var(--color-primary)',
            color: enabled ? 'var(--text-primary)' : '#FFFFFF',
            border: enabled ? '1px solid var(--border-primary)' : 'none',
          }}
        >
          {enabled ? <BellOff size={14} /> : <Bell size={14} />}
          {enabled ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </section>
  )
}
