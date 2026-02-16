import { Menu, Search } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'

export function Header() {
  const { toggleSidebar, setSidebarCollapsed, sidebarCollapsed } = useAppStore()

  return (
    <header
      className="flex items-center gap-3 border-b px-4 py-3"
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
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
      >
        <Menu size={20} />
      </button>

      {/* Search placeholder */}
      <button
        onClick={() => useAppStore.getState().setSearchOpen(true)}
        className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
      >
        <Search size={16} />
        <span>Buscar tareas...</span>
        <kbd
          className="ml-auto hidden rounded px-1.5 py-0.5 text-xs font-mono md:inline-block"
          style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
        >
          Ctrl+K
        </kbd>
      </button>
    </header>
  )
}
