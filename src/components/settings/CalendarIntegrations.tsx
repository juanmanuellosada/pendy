import { useState } from 'react'
import {
  CalendarDays,
  Link2Off,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  Lock,
  Plus,
  X,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  useCalendarIntegrations,
  useConnectCalendar,
  useDisconnectCalendar,
  useGoogleCalendarList,
  useUpdateCalendarSelection,
  useCreateGoogleCalendar,
  useRenameGoogleCalendar,
  useDeleteGoogleCalendar,
  useSetGoogleCalendarColor,
} from '@/hooks/useCalendarIntegrations'
import { useUIStore } from '@/stores/uiStore'

const GOOGLE_COLOR = '#4285F4'

const CALENDAR_COLORS = [
  '#D50000',
  '#E67C73',
  '#F4511E',
  '#F6BF26',
  '#33B679',
  '#0B8043',
  '#039BE5',
  '#3F51B5',
  '#7986CB',
  '#8E24AA',
  '#616161',
  '#4285F4',
]

interface CalendarIntegrationsProps {
  isConnecting?: boolean
  connectError?: string | null
}

export function CalendarIntegrations({
  isConnecting = false,
  connectError = null,
}: CalendarIntegrationsProps) {
  const { data: integrations = [], isLoading } = useCalendarIntegrations()
  const { startOAuth } = useConnectCalendar()
  const disconnect = useDisconnectCalendar()
  const { showConfirmDialog } = useUIStore()

  const googleIntegration = integrations.find((i) => i.provider === 'google' && i.is_active)

  // ── Calendar picker state ──────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false)
  const { data: calendarList = [], isLoading: loadingCals } =
    useGoogleCalendarList(googleIntegration)
  const updateSelection = useUpdateCalendarSelection()
  const createCalendar = useCreateGoogleCalendar()
  const renameCalendar = useRenameGoogleCalendar()
  const deleteCalendar = useDeleteGoogleCalendar()
  const setColor = useSetGoogleCalendarColor()
  const [colorPickerCalendarId, setColorPickerCalendarId] = useState<string | null>(null)
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(CALENDAR_COLORS[5])

  const selectedIds: string[] = googleIntegration?.selected_calendar_ids ?? ['primary']

  const handleDisconnect = () => {
    showConfirmDialog({
      title: 'Desconectar Google Calendar',
      message:
        '¿Desconectar tu cuenta de Google Calendar? Los eventos dejarán de aparecer en Hoy y Próximos.',
      confirmLabel: 'Desconectar',
      onConfirm: () => disconnect.mutate(),
    })
  }

  const handleToggleCalendar = (calendarId: string) => {
    const next = selectedIds.includes(calendarId)
      ? selectedIds.filter((id) => id !== calendarId)
      : [...selectedIds, calendarId]
    if (next.length === 0) return
    updateSelection.mutate({ selectedIds: next })
  }

  const startEditing = (id: string, currentName: string) => {
    setEditingCalendarId(id)
    setEditingName(currentName)
  }

  const cancelEditing = () => {
    setEditingCalendarId(null)
    setEditingName('')
  }

  const handleRename = async (calendarId: string) => {
    if (!editingName.trim() || !googleIntegration) return
    try {
      await renameCalendar.mutateAsync({
        integration: googleIntegration,
        calendarId,
        name: editingName.trim(),
      })
      cancelEditing()
    } catch {
      /* silencioso */
    }
  }

  const handleCreateCalendar = async () => {
    if (!newName.trim() || !googleIntegration) return
    try {
      await createCalendar.mutateAsync({
        integration: googleIntegration,
        name: newName.trim(),
        backgroundColor: newColor,
      })
      setNewName('')
      setNewColor(CALENDAR_COLORS[5])
      setShowNewForm(false)
    } catch {
      /* silencioso */
    }
  }

  const handleDeleteCalendar = (calendarId: string, name: string) => {
    if (!googleIntegration) return
    showConfirmDialog({
      title: 'Eliminar calendario',
      message: `¿Eliminar "${name}"? Esta acción eliminará el calendario y todos sus eventos de Google Calendar.`,
      confirmLabel: 'Eliminar',
      onConfirm: () => deleteCalendar.mutate({ integration: googleIntegration, calendarId }),
    })
  }

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays size={16} style={{ color: 'var(--text-secondary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Calendarios
        </h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Conecta tu Google Calendar para ver y crear eventos junto a tus tareas.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Cargando...
          </span>
        </div>
      ) : (
        <div className="rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
          {/* ── Google Calendar row ── */}
          <div>
            <div className="flex items-center gap-3 p-3">
              <div
                className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${GOOGLE_COLOR}20` }}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: GOOGLE_COLOR }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Google Calendar
                </p>
                {googleIntegration ? (
                  <p className="text-xs truncate" style={{ color: '#22C55E' }}>
                    Conectado{googleIntegration.email ? ` · ${googleIntegration.email}` : ''}
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Muestra tus eventos en Hoy y Próximos
                  </p>
                )}
              </div>

              {googleIntegration ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    className="flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {showPicker ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    Calendarios
                  </button>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnect.isPending}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-accent)'
                      e.currentTarget.style.color = 'var(--color-accent)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }}
                  >
                    {disconnect.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Link2Off size={12} />
                    )}
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={startOAuth}
                  disabled={isConnecting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: GOOGLE_COLOR }}
                >
                  {isConnecting && <Loader2 size={12} className="animate-spin" />}
                  {isConnecting ? 'Conectando...' : 'Conectar'}
                </button>
              )}
            </div>

            {/* Calendar picker */}
            {googleIntegration && showPicker && (
              <div className="border-t" style={{ borderColor: 'var(--border-secondary)' }}>
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Seleccionar calendarios a mostrar
                  </p>
                  <div className="flex items-center gap-2">
                    {updateSelection.isPending && (
                      <Loader2
                        size={12}
                        className="animate-spin"
                        style={{ color: 'var(--text-muted)' }}
                      />
                    )}
                    <button
                      onClick={() => setShowNewForm((v) => !v)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      title="Crear nuevo calendario"
                    >
                      <Plus size={12} />
                      Nuevo
                    </button>
                  </div>
                </div>

                {loadingCals ? (
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <Loader2
                      size={14}
                      className="animate-spin"
                      style={{ color: 'var(--text-muted)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Cargando calendarios...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col pb-1">
                    {/* New calendar form */}
                    {showNewForm && (
                      <div
                        className="mx-3 mb-2 mt-1 rounded-lg p-3 space-y-3"
                        style={{
                          backgroundColor: 'var(--bg-hover)',
                          border: '1px solid var(--border-secondary)',
                        }}
                      >
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Nombre del calendario"
                          autoFocus
                          className="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--bg-primary)',
                            borderColor: 'var(--border-primary)',
                            color: 'var(--text-primary)',
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCreateCalendar()
                            if (e.key === 'Escape') setShowNewForm(false)
                          }}
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CALENDAR_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewColor(color)}
                              className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                              style={{
                                backgroundColor: color,
                                outline: newColor === color ? `2px solid ${color}` : 'none',
                                outlineOffset: '2px',
                              }}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleCreateCalendar}
                            disabled={!newName.trim() || createCalendar.isPending}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: newColor }}
                          >
                            {createCalendar.isPending ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} />
                            )}
                            Crear
                          </button>
                          <button
                            onClick={() => {
                              setShowNewForm(false)
                              setNewName('')
                            }}
                            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            <X size={11} />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {calendarList.map((cal) => {
                      const isChecked = selectedIds.includes(cal.id)
                      const dotColor = cal.backgroundColor ?? GOOGLE_COLOR
                      const isReadOnly =
                        cal.accessRole === 'reader' || cal.accessRole === 'freeBusyReader'
                      const isOwner = cal.accessRole === 'owner'
                      const isRenaming = editingCalendarId === cal.id
                      const isSaving = renameCalendar.isPending && editingCalendarId === cal.id

                      if (isRenaming) {
                        return (
                          <div key={cal.id} className="flex items-center gap-2 px-3 py-1.5">
                            <span
                              className="h-3 w-3 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: dotColor }}
                            />
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              className="flex-1 rounded-md border px-2 py-1 text-sm outline-none"
                              style={{
                                backgroundColor: 'var(--bg-primary)',
                                borderColor: 'var(--border-primary)',
                                color: 'var(--text-primary)',
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(cal.id)
                                if (e.key === 'Escape') cancelEditing()
                              }}
                            />
                            <button
                              onClick={() => handleRename(cal.id)}
                              disabled={!editingName.trim() || isSaving}
                              className="flex-shrink-0 rounded-md p-1.5 disabled:opacity-40"
                              style={{ color: '#22C55E' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              {isSaving ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Check size={13} />
                              )}
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="flex-shrink-0 rounded-md p-1.5"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor = 'transparent')
                              }
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div key={cal.id} className="relative">
                          <div
                            className="group flex items-center gap-3 px-3 py-2 transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'transparent')
                            }
                          >
                            {isOwner ? (
                              <button
                                onClick={() =>
                                  setColorPickerCalendarId(
                                    colorPickerCalendarId === cal.id ? null : cal.id,
                                  )
                                }
                                className="h-3 w-3 flex-shrink-0 rounded-full ring-offset-1 transition-all hover:ring-2"
                                style={{ backgroundColor: dotColor }}
                                title="Cambiar color"
                              />
                            ) : (
                              <span
                                className="h-3 w-3 flex-shrink-0 rounded-full"
                                style={{ backgroundColor: dotColor }}
                              />
                            )}

                            <button
                              className="flex-1 min-w-0 text-left"
                              onClick={() => handleToggleCalendar(cal.id)}
                            >
                              <span className="truncate text-sm block">
                                {cal.summary}
                                {cal.primary && (
                                  <span
                                    className="ml-1.5 text-xs"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    (principal)
                                  </span>
                                )}
                              </span>
                            </button>

                            {isReadOnly && (
                              <span
                                className="flex items-center gap-1 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{
                                  backgroundColor: 'var(--bg-hover)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                <Lock size={9} />
                                Solo lectura
                              </span>
                            )}

                            {isOwner && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button
                                  onClick={() => startEditing(cal.id, cal.summary)}
                                  className="rounded-md p-1 transition-colors"
                                  style={{ color: 'var(--text-muted)' }}
                                  title="Renombrar"
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.backgroundColor = 'transparent')
                                  }
                                >
                                  <Pencil size={12} />
                                </button>
                                {!cal.primary && (
                                  <button
                                    onClick={() => handleDeleteCalendar(cal.id, cal.summary)}
                                    disabled={deleteCalendar.isPending}
                                    className="rounded-md p-1 transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="Eliminar calendario"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor =
                                        'color-mix(in srgb, var(--color-accent) 8%, transparent)'
                                      e.currentTarget.style.color = 'var(--color-accent)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                      e.currentTarget.style.color = 'var(--text-muted)'
                                    }}
                                  >
                                    {deleteCalendar.isPending ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                  </button>
                                )}
                              </div>
                            )}

                            <button
                              onClick={() => handleToggleCalendar(cal.id)}
                              className="flex-shrink-0"
                            >
                              <div
                                className="h-4 w-4 rounded flex items-center justify-center border transition-colors"
                                style={{
                                  borderColor: isChecked ? GOOGLE_COLOR : 'var(--border-primary)',
                                  backgroundColor: isChecked ? GOOGLE_COLOR : 'transparent',
                                }}
                              >
                                {isChecked && <Check size={10} strokeWidth={3} color="#fff" />}
                              </div>
                            </button>
                          </div>

                          {/* Color picker popover */}
                          {colorPickerCalendarId === cal.id && (
                            <div
                              className="mx-3 mb-2 rounded-lg p-2.5"
                              style={{
                                backgroundColor: 'var(--bg-hover)',
                                border: '1px solid var(--border-secondary)',
                              }}
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {CALENDAR_COLORS.map((color) => (
                                  <button
                                    key={color}
                                    onClick={async () => {
                                      if (!googleIntegration) return
                                      await setColor.mutateAsync({
                                        integration: googleIntegration,
                                        calendarId: cal.id,
                                        backgroundColor: color,
                                      })
                                      setColorPickerCalendarId(null)
                                    }}
                                    disabled={setColor.isPending}
                                    className="w-5 h-5 rounded-full transition-transform hover:scale-110 disabled:opacity-50"
                                    style={{
                                      backgroundColor: color,
                                      outline: dotColor === color ? `2px solid ${color}` : 'none',
                                      outlineOffset: '2px',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error al conectar */}
      {connectError && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg p-3"
          style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}
        >
          <AlertCircle
            size={14}
            className="mt-0.5 flex-shrink-0"
            style={{ color: 'var(--color-accent)' }}
          />
          <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
            {connectError}
          </p>
        </div>
      )}
    </section>
  )
}
