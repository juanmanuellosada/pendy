import { useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Calendar,
  CalendarPlus,
  Plus,
  ChevronDown,
  ChevronRight,
  Hash,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
  CheckCircle2,
  Inbox,
} from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useUIStore } from '@/stores/uiStore'
import { useAppStore } from '@/stores/appStore'
import { useCalendarIntegrations } from '@/hooks/useCalendarIntegrations'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { data: projects = [] } = useProjects()
  const { setProjectEditorOpen } = useUIStore()
  const { sidebarCollapsed, setSidebarOpen, setQuickAddOpen, setEventEditorOpen } = useAppStore()
  const { isDark, setTheme } = useTheme()
  const { data: integrations = [] } = useCalendarIntegrations()
  const isCalendarConnected = integrations.length > 0
  const [projectsExpanded, setProjectsExpanded] = useState(true)

  const regularProjects = projects.filter((p) => !p.is_inbox && !p.is_archived)
  const favoriteProjects = projects.filter((p) => p.is_favorite && !p.is_archived)

  const navItems = [
    { icon: Inbox, label: 'Bandeja de entrada', path: '/app/inbox', shortcut: 'I' },
    { icon: CalendarDays, label: 'Hoy', path: '/app/today', shortcut: 'H' },
    { icon: Calendar, label: 'Próximo', path: '/app/upcoming', shortcut: 'P' },
    { icon: CheckCircle2, label: 'Completado', path: '/app/completed', shortcut: 'C' },
  ]

  const handleNav = (path: string) => {
    navigate(path)
    setSidebarOpen(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login')
  }

  if (sidebarCollapsed) {
    return (
      <div className="flex h-full flex-col items-center py-4">
        <img src="/pendy-logo.png" alt="Pendy" className="h-8 w-8 rounded-lg" />
        <div className="mt-4 flex flex-col gap-1">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="rounded-lg p-2.5 transition-colors"
            style={{ backgroundColor: '#EC1E2A', color: '#FFFFFF' }}
            title="Añadir tarea (Q)"
          >
            <Plus size={20} />
          </button>
          <button
            onClick={() => isCalendarConnected && setEventEditorOpen(true)}
            disabled={!isCalendarConnected}
            className="rounded-lg p-2.5 transition-colors"
            style={{
              backgroundColor: '#283B56',
              color: '#FFFFFF',
              opacity: isCalendarConnected ? 1 : 0.4,
              cursor: isCalendarConnected ? 'pointer' : 'not-allowed',
            }}
            title={isCalendarConnected ? 'Añadir evento (E)' : 'Conecta un calendario para añadir eventos'}
          >
            <CalendarPlus size={20} />
          </button>
          <button
            onClick={() => handleNav('/app/search')}
            className="rounded-lg p-2.5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Buscador (S)"
          >
            <Search size={20} />
          </button>
        </div>
        <nav className="mt-2 flex flex-col gap-1">
          {navItems.map(({ icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => handleNav(path)}
              className="rounded-lg p-2.5 transition-colors"
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

      <div className="flex flex-col gap-0.5 px-2">
        {/* Añadir tarea */}
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#EC1E2A', color: '#FFFFFF' }}
        >
          <Plus size={18} />
          <span className="flex-1 text-left">Añadir tarea</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
          >
            Q
          </span>
        </button>

        {/* Añadir evento */}
        <button
          onClick={() => isCalendarConnected && setEventEditorOpen(true)}
          disabled={!isCalendarConnected}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all"
          style={{
            backgroundColor: '#283B56',
            color: '#FFFFFF',
            opacity: isCalendarConnected ? 1 : 0.4,
            cursor: isCalendarConnected ? 'pointer' : 'not-allowed',
          }}
          title={isCalendarConnected ? undefined : 'Conecta un calendario en Configuración para añadir eventos'}
        >
          <CalendarPlus size={18} />
          <span className="flex-1 text-left">Añadir evento</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF' }}
          >
            E
          </span>
        </button>

        {/* Buscador */}
        <button
          onClick={() => handleNav('/app/search')}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            location.pathname === '/app/search' ? 'text-white' : 'hover:opacity-80',
          )}
          style={{
            backgroundColor: location.pathname === '/app/search' ? '#283B56' : 'transparent',
            color: location.pathname === '/app/search' ? '#FFFFFF' : 'var(--text-primary)',
          }}
        >
          <Search size={18} />
          <span className="flex-1 text-left">Buscador</span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[10px]"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              opacity: location.pathname === '/app/search' ? 0.7 : 1,
            }}
          >
            S
          </span>
        </button>

        {/* Separador */}
        <div className="my-1 mx-3 border-t" style={{ borderColor: 'var(--border-primary)' }} />

        {/* Nav items */}
        {navItems.map(({ icon: Icon, label, path, shortcut }) => (
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
            <span className="flex-1 text-left">{label}</span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-muted)',
                opacity: location.pathname === path ? 0.7 : 1,
              }}
            >
              {shortcut}
            </span>
          </button>
        ))}
      </div>

      {/* Favorites */}
      {favoriteProjects.length > 0 && (
        <div className="mt-6 px-2">
          <div className="flex items-center px-3 py-1">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
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

      {/* Mis proyectos */}
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
              Mis proyectos
            </span>
          </button>
          <button
            onClick={() => setProjectEditorOpen(true)}
            className="rounded p-1 transition-colors hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
            title="Nuevo proyecto"
          >
            <Plus size={16} />
          </button>
        </div>

        {projectsExpanded && (
          <div className="mt-1 flex flex-col gap-0.5">
            {regularProjects.length === 0 ? (
              <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Sin proyectos
              </p>
            ) : (
              regularProjects.map((project) => (
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
              ))
            )}
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
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-lg p-2 text-sm transition-colors hover:opacity-70"
            style={{ color: 'var(--text-secondary)' }}
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}


