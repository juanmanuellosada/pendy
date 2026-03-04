import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { useUndo } from '@/hooks/useActivityLog'
import { HabitDetail } from '@/components/habits/HabitDetail'
import { CalendarEventEditor } from '@/components/common/CalendarEventEditor'
import { useAppStore } from '@/stores/appStore'
import { useUIStore } from '@/stores/uiStore'
import { useCalendarIntegrations } from '@/hooks/useCalendarIntegrations'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { useAppBadge } from '@/hooks/useAppBadge'
import { useIsMobile } from '@/hooks/useIsMobile'
import { OfflineBanner } from '@/components/common/OfflineBanner'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

export function AppLayout() {
  const {
    sidebarOpen,
    sidebarCollapsed,
    taskDetailOpen,
    habitDetailOpen,
    setQuickAddOpen,
    eventEditorOpen,
    setEventEditorOpen,
    selectedTaskId,
  } = useAppStore()
  const { getViewOptions } = useUIStore()
  const { data: integrations = [] } = useCalendarIntegrations()
  usePushNotifications() // registers SW and syncs subscription on login
  useAppBadge() // syncs PWA badge with today's pending count
  useRealtimeSync() // live sync across tabs/devices via Supabase Realtime
  const undo = useUndo()
  const isCalendarConnected = integrations.length > 0
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Atajos de teclado globales (G+key chords per spec)
  useEffect(() => {
    let gPressed = false
    let gTimer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: KeyboardEvent) => {
      // Ctrl+Z → Undo (works from anywhere)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo.mutate()
        return
      }

      const tag = (e.target as HTMLElement).tagName
      const isInput =
        tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable

      if (isInput) return

      const key = e.key.toLowerCase()

      // G chord: G then I/T/U/C/A
      if (!e.ctrlKey && !e.metaKey && key === 'g' && !gPressed) {
        gPressed = true
        if (gTimer) clearTimeout(gTimer)
        gTimer = setTimeout(() => {
          gPressed = false
        }, 500)
        return
      }

      if (gPressed && !e.ctrlKey && !e.metaKey) {
        gPressed = false
        if (gTimer) clearTimeout(gTimer)

        if (key === 'i') {
          e.preventDefault()
          navigate('/app/inbox')
          return
        }
        if (key === 't') {
          e.preventDefault()
          navigate('/app/today')
          return
        }
        if (key === 'u') {
          e.preventDefault()
          navigate('/app/upcoming')
          return
        }
        if (key === 'c') {
          e.preventDefault()
          navigate('/app/completed')
          return
        }
        if (key === 'a') {
          e.preventDefault()
          navigate('/app/habits')
          return
        }
      }

      gPressed = false

      // S → Buscador
      if (!e.ctrlKey && !e.metaKey && key === 's') {
        e.preventDefault()
        navigate('/app/search')
        return
      }

      // Q → Añadir tarea
      if (!e.ctrlKey && !e.metaKey && key === 'q') {
        e.preventDefault()
        setQuickAddOpen(true)
        return
      }

      // E → Añadir evento (solo si hay calendario conectado)
      if (!e.ctrlKey && !e.metaKey && key === 'e') {
        if (isCalendarConnected) {
          e.preventDefault()
          setEventEditorOpen(true)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (gTimer) clearTimeout(gTimer)
    }
  }, [navigate, setQuickAddOpen, setEventEditorOpen, isCalendarConnected])

  // En mobile, redirigir el panel de TaskDetail a la vista fullscreen
  useEffect(() => {
    if (
      isMobile &&
      taskDetailOpen &&
      selectedTaskId &&
      !location.pathname.startsWith('/app/task/')
    ) {
      navigate(`/app/task/${selectedTaskId}`)
    }
  }, [isMobile, taskDetailOpen, selectedTaskId, location.pathname, navigate])

  // Detectar si estamos en la vista de tarea a pantalla completa
  const isTaskPage = location.pathname.startsWith('/app/task/')

  // Detectar si la vista actual está en modo calendario para usar ancho completo
  const viewId = location.pathname.startsWith('/app/upcoming')
    ? 'upcoming'
    : location.pathname.startsWith('/app/today')
      ? 'today'
      : location.pathname.startsWith('/app/inbox')
        ? 'inbox'
        : location.pathname.startsWith('/app/project/')
          ? `project-${location.pathname.split('/').pop()}`
          : null
  const viewStyle = viewId ? getViewOptions(viewId).viewStyle : 'list'
  const isWideMode = viewStyle === 'calendar' || viewStyle === 'panel'

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar overlay for mobile (onPointerUp for iOS Safari) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 cursor-pointer bg-black/50 md:hidden"
          onPointerUp={() => useAppStore.getState().setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r transition-all duration-300 md:relative md:z-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          sidebarCollapsed ? 'w-16' : 'w-72',
        )}
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-primary)' }}
      >
        <Sidebar />
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <OfflineBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
          <div
            className={cn(
              'mx-auto',
              isTaskPage || isWideMode ? 'max-w-full' : taskDetailOpen ? 'max-w-2xl' : 'max-w-3xl',
            )}
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Task detail right panel (hidden on fullscreen task page and on mobile) */}
      {taskDetailOpen && !isTaskPage && !isMobile && <TaskDetail />}

      {/* Habit detail right panel */}
      {habitDetailOpen && !isMobile && <HabitDetail />}

      {/* Global calendar event editor */}
      {eventEditorOpen && <CalendarEventEditor onClose={() => setEventEditorOpen(false)} />}

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
