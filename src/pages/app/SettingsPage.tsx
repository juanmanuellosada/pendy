import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useLabels, useCreateLabel, useDeleteLabel, useUpdateLabel, LABEL_COLORS } from '@/hooks/useLabels'
import { useExchangeCalendarCode } from '@/hooks/useCalendarIntegrations'
import { ColorPicker } from '@/components/common/ColorPicker'
import { CalendarIntegrations } from '@/components/settings/CalendarIntegrations'
import { useUIStore } from '@/stores/uiStore'
import { Moon, Sun, Monitor, Trash2, Plus, Pencil, Check } from 'lucide-react'
import type { ThemeMode } from '@/styles/themes'

export default function SettingsPage() {
  const { profile, session } = useAuth()
  const { mode, setTheme } = useTheme()
  const { data: labels = [] } = useLabels()
  const createLabel = useCreateLabel()
  const updateLabel = useUpdateLabel()
  const deleteLabel = useDeleteLabel()
  const { showConfirmDialog } = useUIStore()
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

  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[3]!)
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null)
  const [editingLabelName, setEditingLabelName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleCreateLabel = async () => {
    const name = newLabelName.trim()
    if (!name) return
    await createLabel.mutateAsync({ name, color: newLabelColor })
    setNewLabelName('')
    setNewLabelColor(LABEL_COLORS[3]!)
  }

  const startEditingLabel = (id: string, name: string) => {
    setEditingLabelId(id)
    setEditingLabelName(name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  const saveEditingLabel = (id: string, currentColor: string) => {
    const name = editingLabelName.trim()
    if (name) updateLabel.mutate({ id, updates: { name, color: currentColor } })
    setEditingLabelId(null)
  }

  const handleDeleteLabel = (id: string, name: string) => {
    showConfirmDialog({
      title: 'Eliminar etiqueta',
      message: `¿Eliminar la etiqueta «${name}»? Se quitará de todas las tareas que la usen.`,
      confirmLabel: 'Eliminar',
      onConfirm: () => deleteLabel.mutate(id),
    })
  }

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

        {/* Calendar integrations section */}
        <CalendarIntegrations
          isConnecting={exchangeCode.isPending}
          connectError={exchangeCode.isError ? (exchangeCode.error instanceof Error ? exchangeCode.error.message : 'Error al conectar el calendario') : null}
        />

        {/* Labels section */}
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Mis etiquetas
          </h2>

          {/* Formulario de creación */}
          <div className="mt-4 flex items-center gap-2">
            <ColorPicker value={newLabelColor} onChange={setNewLabelColor} />

            <input
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLabel() }}
              placeholder="Nombre de la etiqueta..."
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />

            <button
              onClick={handleCreateLabel}
              disabled={!newLabelName.trim() || createLabel.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: '#283B56' }}
            >
              <Plus size={14} />
              Crear
            </button>
          </div>

          {/* Lista de etiquetas */}
          {labels.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay etiquetas creadas aún.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1">
              {labels.map((label) => {
                const isEditing = editingLabelId === label.id
                return (
                  <li
                    key={label.id}
                    className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
                    style={{ backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Selector de color */}
                    <ColorPicker
                      size="sm"
                      value={label.color}
                      onChange={(color) =>
                        updateLabel.mutate({ id: label.id, updates: { color } })
                      }
                    />

                    {/* Nombre — normal o edición inline */}
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editingLabelName}
                        onChange={(e) => setEditingLabelName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditingLabel(label.id, label.color)
                          if (e.key === 'Escape') setEditingLabelId(null)
                        }}
                        onBlur={() => saveEditingLabel(label.id, label.color)}
                        className="flex-1 rounded border px-2 py-0.5 text-sm outline-none"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-primary)',
                          color: 'var(--text-primary)',
                        }}
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-text text-sm"
                        style={{ color: 'var(--text-primary)' }}
                        onDoubleClick={() => startEditingLabel(label.id, label.name)}
                      >
                        {label.name}
                      </span>
                    )}

                    {/* Acciones */}
                    {isEditing ? (
                      <button
                        onMouseDown={(e) => { e.preventDefault(); saveEditingLabel(label.id, label.color) }}
                        className="rounded p-1"
                        style={{ color: '#22C55E' }}
                        title="Guardar"
                      >
                        <Check size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => startEditingLabel(label.id, label.name)}
                          className="rounded p-1 transition-all"
                          style={{ color: 'var(--text-muted)', backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(40,59,86,0.12)'
                            e.currentTarget.style.color = '#283B56'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = 'var(--text-muted)'
                          }}
                          title="Editar nombre"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteLabel(label.id, label.name)}
                          className="rounded p-1 transition-all"
                          style={{ color: '#EC1E2A', backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(236,30,42,0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                          title="Eliminar etiqueta"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
