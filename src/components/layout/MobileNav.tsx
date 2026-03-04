import { useLocation, useNavigate } from 'react-router-dom'
import { Inbox, CalendarDays, Calendar, Plus } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'

export function MobileNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setQuickAddOpen } = useAppStore()

  const items = [
    { icon: Inbox, label: 'Entrada', path: '/app/inbox' },
    { icon: CalendarDays, label: 'Hoy', path: '/app/today' },
    { icon: Calendar, label: 'Proximos', path: '/app/upcoming' },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-10 border-t md:hidden"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Navegación principal"
      role="navigation"
    >
      <div className="flex items-center justify-around py-3">
        {items.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn(
              'flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
            )}
            style={{
              color: location.pathname === path ? 'var(--color-primary)' : 'var(--text-muted)',
            }}
            aria-label={label}
            aria-current={location.pathname === path ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: 'var(--color-accent)' }}
          aria-label="Agregar tarea"
        >
          <Plus size={22} />
          <span>Agregar</span>
        </button>
      </div>
    </nav>
  )
}
