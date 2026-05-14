import { Download, Smartphone, Monitor, CheckCircle2, Info } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

// ── PWA Block ────────────────────────────────────────────────────────────────

function PwaBlock() {
  const { canInstallPwa, isStandalone, isTauri, os, promptInstallPwa } = useInstallPrompt()

  if (isTauri) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            PWA
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#22C55E' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Estás usando la versión de escritorio nativa
          </p>
        </div>
      </div>
    )
  }

  if (isStandalone) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            PWA
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#22C55E' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ya está instalada como PWA
          </p>
        </div>
      </div>
    )
  }

  if (os === 'ios') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            PWA
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            En Safari, tocá{' '}
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Compartir
            </span>{' '}
            →{' '}
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Agregar a pantalla de inicio
            </span>
          </p>
        </div>
      </div>
    )
  }

  if (canInstallPwa) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Smartphone size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            PWA
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Instalá Pendy como una app en tu dispositivo sin ocupar espacio de tienda.
        </p>
        <button
          onClick={() => promptInstallPwa()}
          className="flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Download size={14} />
          Instalar PWA
        </button>
      </div>
    )
  }

  // Fallback: browser without support (Firefox, Safari desktop, etc.)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Smartphone size={15} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          PWA
        </p>
      </div>
      <div className="flex items-start gap-2">
        <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tu navegador no soporta instalación PWA. Probá Chrome, Brave o Edge.
        </p>
      </div>
    </div>
  )
}

// ── Desktop Block ─────────────────────────────────────────────────────────────

function DesktopBlock() {
  const { isTauri, os, latestReleaseUrl } = useInstallPrompt()

  // Not applicable on mobile OSes
  if ((os === 'android' || os === 'ios') && !isTauri) {
    return null
  }

  if (isTauri) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Monitor size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Escritorio
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#22C55E' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Ya estás usando la versión de escritorio
          </p>
        </div>
      </div>
    )
  }

  if (os === 'linux') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Monitor size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Escritorio
          </p>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Descargá la app nativa para Linux. Incluye integración con el sistema y badge de tareas en
          KDE.
        </p>
        <a
          href={latestReleaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Download size={14} />
          Descargar para Linux
        </a>
      </div>
    )
  }

  // macOS or Windows
  if (os === 'mac' || os === 'windows') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Monitor size={15} style={{ color: 'var(--text-secondary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Escritorio
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Próximamente para macOS/Windows
          </p>
        </div>
      </div>
    )
  }

  // 'other' OS — show Linux download as best option
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Monitor size={15} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Escritorio
        </p>
      </div>
      <a
        href={latestReleaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        <Download size={14} />
        Descargar para Linux
      </a>
    </div>
  )
}

// ── InstallOptions ────────────────────────────────────────────────────────────

export function InstallOptions() {
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: 'var(--border-primary)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Aplicación
      </h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        Instalá Pendy directamente en tu dispositivo para un acceso más rápido.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <PwaBlock />
        <DesktopBlock />
      </div>
    </section>
  )
}
