import { useLocation, useNavigate } from 'react-router-dom'
import {
  Inbox,
  CalendarDays,
  Calendar,
  Plus,
  ChevronDown,
  ChevronRight,
  Hash,
  Star,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useUIStore } from '@/stores/uiStore'
import { useAppStore } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { data: projects = [] } = useProjects()
  const { setProjectEditorOpen } = useUIStore()
  const { sidebarCollapsed, setSidebarOpen } = useAppStore()
  const { isDark, setTheme } = useTheme()
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  const regularProjects = projects.filter((p) => !p.is_inbox && !p.is_archived)
  const favoriteProjects = projects.filter((p) => p.is_favorite && !p.is_archived)

  const navItems = [
    { icon: Inbox, label: 'Entrada', path: '/app/inbox' },
    { icon: CalendarDays, label: 'Hoy', path: '/app/today' },
    { icon: Calendar, label: 'Próximos', path: '/app/upcoming' },
  ]

  const handleNav = (path: string) => {
    navigate(path)
    setSidebarOpen(false) // close on mobile
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  if (sidebarCollapsed) {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <img src="/pendy-logo.png" alt="Pendy" className="h-8 w-8 rounded-lg" />
        <nav className="mt-6 flex flex-col gap-1">
          {navItems.map(({ icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className={cn(
                'rounded-lg p-2.5 transition-colors',
                location.pathname === path ? 'text-white' : '',
              )}
              style={{
                backgroundColor: location.pathname === path ? '#283B56' : 'transparent',
                color: location.pathname === path ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              <Icon size={20} />
            </button>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <img src="/pendy-logo.png" alt="Pendy" className="h-8 w-8 rounded-lg" />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {profile?.full_name || 'Usuario'}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {user?.email}
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="mt-2 flex flex-col gap-0.5 px-2">
        {navItems.map(({ icon: Icon, label, path }) => (
          <button
            key={path}
            onClick={() => handleNav(path)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              location.pathname === path ? 'text-white' : 'hover:opacity-80',
            )}
            style={{
              backgroundColor: location.pathname === path ? '#283B56' : 'transparent',
              color: location.pathname === path ? '#FFFFFF' : 'var(--text-primary)',
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      {/* Favorites */}
      {favoriteProjects.length > 0 && (
        <div className="mt-6 px-2">
          <div className="flex items-center px-3 py-1">
            <Star size={14} style={{ color: 'var(--text-muted)' }} />
            <span className="ml-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Favoritos
            </span>
          </div>
          {favoriteProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleNav(`/app/project/${project.id}`)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                location.pathname === `/app/project/${project.id}` ? 'font-medium' : '',
              )}
              style={{
                backgroundColor:
                  location.pathname === `/app/project/${project.id}`
                    ? 'var(--bg-active)'
                    : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              <Hash size={16} style={{ color: project.color }} />
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Projects */}
      <div className="mt-6 flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-3 py-1">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="flex items-center gap-1"
          >
            {projectsExpanded ? (
              <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
            ) : (
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
            )}
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Proyectos
            </span>
          </button>
          <button
            onClick={() => setProjectEditorOpen(true)}
            className="rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <Plus size={16} />
          </button>
        </div>

        {projectsExpanded && (
          <div className="mt-1 flex flex-col gap-0.5">
            {regularProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleNav(`/app/project/${project.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  location.pathname === `/app/project/${project.id}` ? 'font-medium' : '',
                )}
                style={{
                  backgroundColor:
                    location.pathname === `/app/project/${project.id}`
                      ? 'var(--bg-active)'
                      : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <Hash size={16} style={{ color: project.color }} />
                <span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-2 py-3" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title={isDark ? 'Modo claro' : 'Modo oscuro'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={() => handleNav('/app/settings')}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title="Configuracion"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title="Cerrar sesion"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
