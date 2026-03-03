import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

export function Header() {
  const { toggleSidebar, setSidebarCollapsed, sidebarCollapsed } = useAppStore()

  return (
    <header
      className="flex items-center gap-3 border-b px-4 py-3"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-1.5 transition-colors hover:opacity-70 md:hidden"
        style={{ color: 'var(--text-primary)' }}
      >
        <Menu size={22} />
      </button>

      {/* Desktop collapse button */}
      <button
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        className="hidden rounded-lg p-1.5 transition-colors hover:opacity-70 md:block"
        style={{ color: 'var(--text-primary)' }}
        title={sidebarCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
    </header>
  )
}
