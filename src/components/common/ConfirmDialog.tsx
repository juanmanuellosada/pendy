import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export function ConfirmDialog() {
  const { confirmDialogOpen, confirmDialogConfig, hideConfirmDialog } = useUIStore()

  useEffect(() => {
    if (!confirmDialogOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideConfirmDialog()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [confirmDialogOpen, hideConfirmDialog])

  if (!confirmDialogOpen || !confirmDialogConfig) return null

  const handleConfirm = () => {
    confirmDialogConfig.onConfirm()
    hideConfirmDialog()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="animate-fade-backdrop fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
        onClick={hideConfirmDialog}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="animate-scale-in w-full max-w-sm rounded-2xl border p-6 shadow-2xl pointer-events-auto"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {/* Icono */}
          <div
            className="mb-4 flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 10%, transparent)' }}
          >
            <AlertTriangle size={20} style={{ color: 'var(--color-accent)' }} />
          </div>

          {/* Título */}
          <h2 className="mb-1.5 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            {confirmDialogConfig.title}
          </h2>

          {/* Mensaje */}
          <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {confirmDialogConfig.message}
          </p>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={hideConfirmDialog}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover-bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {confirmDialogConfig.confirmLabel ?? 'Eliminar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
