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
      style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
    >
      <div className="flex items-center justify-around py-2">
        {items.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn('flex flex-col items-center gap-0.5 px-3 py-1 text-xs')}
            style={{
              color: location.pathname === path ? '#283B56' : 'var(--text-muted)',
            }}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs"
          style={{ color: '#EC1E2A' }}
        >
          <Plus size={20} />
          <span>Agregar</span>
        </button>
      </div>
    </nav>
  )
}
