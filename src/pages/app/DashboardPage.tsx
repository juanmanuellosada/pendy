import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, CheckCircle2, AlertCircle, Calendar, Folder, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

export default function DashboardPage() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100)
  }, [])

  // Mock data - replace with real data from useTasks hook
  const stats = {
    today: 8,
    overdue: 3,
    completedWeek: 24
  }

  const todayTasks = [
    { id: 1, title: 'Revisar propuesta de diseño', completed: false, priority: 1 },
    { id: 2, title: 'Llamar al cliente a las 3pm', completed: false, priority: 2 },
    { id: 3, title: 'Actualizar documentación del proyecto', completed: true, priority: 3 },
    { id: 4, title: 'Preparar presentación para mañana', completed: false, priority: 1 },
    { id: 5, title: 'Revisar emails pendientes', completed: false, priority: 4 }
  ]

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return '#EC1E2A'
      case 2: return '#F59E0B'
      case 3: return '#3B82F6'
      default: return '#6B7280'
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'Usuario'

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Background subtle pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.05]"
        style={{
          backgroundImage: isDark
            ? `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`
            : `linear-gradient(#283B56 1px, transparent 1px), linear-gradient(90deg, #283B56 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <header
          className={`mb-12 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1
                className="text-4xl md:text-5xl font-black mb-2 text-gray-900 dark:text-white"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  letterSpacing: '-0.02em'
                }}
              >
                {getGreeting()}, {firstName}
              </h1>
              <p
                className="text-lg text-gray-600 dark:text-gray-300"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                {new Date().toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <Link
                to="/app/inbox"
                className="group flex items-center gap-2 px-6 py-3 text-white font-bold transition-all hover:scale-105 hover:shadow-xl"
                style={{
                  backgroundColor: '#EC1E2A',
                  borderRadius: '12px',
                  fontFamily: '"Outfit", system-ui, sans-serif'
                }}
              >
                <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
                <span className="hidden sm:inline">Nueva Tarea</span>
              </Link>

              <Link
                to="/app/projects"
                className="flex items-center gap-2 px-6 py-3 font-bold transition-all hover:scale-105 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white"
                style={{
                  borderRadius: '12px',
                  fontFamily: '"Outfit", system-ui, sans-serif'
                }}
              >
                <Folder className="w-5 h-5" />
                <span className="hidden sm:inline">Proyectos</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Today's Tasks */}
          <div
            className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-8 transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl border border-gray-200 dark:border-gray-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{
              transitionDelay: '100ms'
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
              >
                <Calendar className="w-6 h-6" style={{ color: '#3B82F6' }} strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-sm font-semibold uppercase tracking-wider text-gray-500"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                Hoy
              </p>
              <p
                className="text-5xl font-black text-blue-600 dark:text-blue-400"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif'
                }}
              >
                {stats.today}
              </p>
              <p
                className="text-gray-600 dark:text-gray-300"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                tareas pendientes
              </p>
            </div>

            {/* Accent corner */}
            <div
              className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
                borderRadius: '0 16px 0 0'
              }}
            />
          </div>

          {/* Overdue Tasks */}
          <div
            className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-8 transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl border border-gray-200 dark:border-gray-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{
              transitionDelay: '200ms'
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: 'rgba(236, 30, 42, 0.1)' }}
              >
                <AlertCircle className="w-6 h-6" style={{ color: '#EC1E2A' }} strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-sm font-semibold uppercase tracking-wider text-gray-500"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                Vencidas
              </p>
              <p
                className="text-5xl font-black text-red-600 dark:text-red-400"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif'
                }}
              >
                {stats.overdue}
              </p>
              <p
                className="text-gray-600 dark:text-gray-300"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                necesitan atención
              </p>
            </div>

            <div
              className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: 'radial-gradient(circle at top right, rgba(236, 30, 42, 0.1) 0%, transparent 70%)',
                borderRadius: '0 16px 0 0'
              }}
            />
          </div>

          {/* Completed This Week */}
          <div
            className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-8 transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl border border-gray-200 dark:border-gray-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{
              transitionDelay: '300ms'
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="p-3 rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
              >
                <TrendingUp className="w-6 h-6" style={{ color: '#22C55E' }} strokeWidth={2.5} />
              </div>
            </div>

            <div className="space-y-2">
              <p
                className="text-sm font-semibold uppercase tracking-wider text-gray-500"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                Esta Semana
              </p>
              <p
                className="text-5xl font-black text-green-600 dark:text-green-400"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif'
                }}
              >
                {stats.completedWeek}
              </p>
              <p
                className="text-gray-600 dark:text-gray-300"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                tareas completadas
              </p>
            </div>

            <div
              className="absolute top-0 right-0 w-20 h-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{
                background: 'radial-gradient(circle at top right, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
                borderRadius: '0 16px 0 0'
              }}
            />
          </div>
        </div>

        {/* Today's Tasks */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-2xl p-8 transition-all duration-700 border border-gray-200 dark:border-gray-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{
            transitionDelay: '400ms'
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-2xl font-black text-gray-900 dark:text-white"
              style={{
                fontFamily: '"Outfit", system-ui, sans-serif'
              }}
            >
              Tareas de Hoy
            </h2>
            <Link
              to="/app/today"
              className="text-sm font-semibold hover:underline"
              style={{
                color: '#EC1E2A',
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif'
              }}
            >
              Ver todas →
            </Link>
          </div>

          <div className="space-y-3">
            {todayTasks.map((task, index) => (
              <div
                key={task.id}
                className="group flex items-center gap-4 p-4 rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                style={{
                  border: '1px solid transparent',
                  transitionDelay: `${450 + index * 50}ms`
                }}
              >
                {/* Checkbox */}
                <button
                  className="flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    borderColor: task.completed ? '#22C55E' : '#D1D5DB',
                    backgroundColor: task.completed ? '#22C55E' : 'transparent'
                  }}
                >
                  {task.completed && (
                    <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={3} />
                  )}
                </button>

                {/* Task title */}
                <p
                  className={`flex-1 transition-all ${
                    task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                  }`}
                  style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
                >
                  {task.title}
                </p>

                {/* Priority indicator */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getPriorityColor(task.priority) }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
    </div>
  )
}
