import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Zap,
  Calendar,
  Tag,
  ArrowRight,
  Repeat,
  Bell,
  Heart,
  Flame,
} from 'lucide-react'

const features = [
  {
    icon: CheckCircle2,
    title: 'Proyectos y subtareas',
    description:
      'Estructura tu trabajo con proyectos anidados, secciones y subtareas ilimitadas. Cada cosa en su lugar.',
  },
  {
    icon: Zap,
    title: 'Captura rápida',
    description:
      'Escribe "Llamar al dentista mañana p2 #salud" y Pendy interpreta la fecha, prioridad y etiqueta al instante.',
  },
  {
    icon: Calendar,
    title: 'Vista de calendario',
    description:
      'Integración con Google Calendar y Outlook. Ve tus tareas, hábitos y eventos en una sola vista.',
  },
  {
    icon: Flame,
    title: 'Hábitos y rutinas',
    description:
      'Construye rutinas con seguimiento de rachas, heatmap de actividad y vista en el calendario. Diarios, semanales o en días específicos.',
    highlight: true,
  },
  {
    icon: Tag,
    title: 'Filtros avanzados',
    description:
      'Etiquetas de colores, prioridades P1–P4 y un lenguaje de filtros para encontrar cualquier tarea.',
  },
  {
    icon: Repeat,
    title: 'Recurrencia inteligente',
    description:
      'Tareas que se repiten cada día, semana o en patrones complejos. Calculadas desde la fecha o desde la completación.',
  },
  {
    icon: Bell,
    title: 'Recordatorios',
    description: 'Notificaciones push y por email. Elige exactamente cuándo quieres que te avisen.',
  },
]

const mockTasks = [
  {
    title: 'Revisar propuesta de diseño',
    priority: '#EC1E2A',
    label: 'Trabajo',
    done: true,
    time: '9:00',
  },
  {
    title: 'Llamar al proveedor',
    priority: '#F59E0B',
    label: 'Trabajo',
    done: false,
    time: '11:30',
  },
  { title: 'Comprar verduras para la semana', priority: '#6B7280', label: 'Compras', done: false },
  {
    title: 'Revisar métricas del proyecto',
    priority: '#3B82F6',
    label: 'Trabajo',
    done: false,
    time: '15:00',
  },
  { title: 'Actualizar documentación', priority: '#6B7280', label: 'Personal', done: false },
]

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    setTimeout(() => setIsVisible(true), 120)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-[#0f1117] overflow-hidden">
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col"
        style={{ backgroundColor: '#16202f' }}
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
          }}
        />

        {/* Glows */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(236,30,42,0.1) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at bottom left, rgba(40,59,86,0.4) 0%, transparent 65%)',
          }}
        />

        {/* Nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}pendy-logo.png`}
              alt="Pendy"
              className="w-8 h-8 rounded-lg"
            />
            <span
              className="text-white font-bold text-xl tracking-tight"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            >
              Pendy
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/auth/login"
              className="px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth/register"
              className="px-5 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{
                backgroundColor: '#EC1E2A',
                borderRadius: '8px',
                fontFamily: '"DM Sans", system-ui, sans-serif',
              }}
            >
              Crear cuenta
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Status badge */}
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 mb-10 transition-all duration-700 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: '100px',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span
                className="text-white/50 text-sm"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                En desarrollo activo
              </span>
            </div>

            {/* Headline */}
            <h1
              className={`font-black text-white leading-[0.95] mb-8 transition-all duration-700 delay-100 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontSize: 'clamp(56px, 10vw, 96px)',
                letterSpacing: '-0.03em',
              }}
            >
              Tu sistema.
              <br />
              <span style={{ color: '#EC1E2A' }}>Sin ruido.</span>
            </h1>

            <p
              className={`text-lg md:text-xl text-white/55 max-w-lg mx-auto leading-relaxed mb-12 transition-all duration-700 delay-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
            >
              Gestión de tareas y hábitos pensada para la claridad. Proyectos, calendario, rutinas y
              recordatorios — todo integrado.
            </p>

            {/* CTAs */}
            <div
              className={`flex flex-col sm:flex-row gap-4 items-center justify-center transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <Link
                to="/auth/register"
                className="group flex items-center gap-2 px-9 py-4 text-base font-bold text-white transition-all hover:scale-[1.03]"
                style={{
                  backgroundColor: '#EC1E2A',
                  borderRadius: '10px',
                  fontFamily: '"DM Sans", system-ui, sans-serif',
                  boxShadow: '0 0 48px rgba(236,30,42,0.28)',
                }}
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/auth/login"
                className="flex items-center gap-2 px-9 py-4 text-base font-medium text-white/55 hover:text-white/80 transition-colors"
                style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 flex justify-center pb-10 opacity-30">
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <span
              className="text-white text-[10px] uppercase tracking-[0.2em]"
              style={{ fontFamily: '"DM Sans", system-ui' }}
            >
              ver más
            </span>
            <div className="w-px h-10 bg-gradient-to-b from-white to-transparent" />
          </div>
        </div>
      </section>

      {/* ── APP PREVIEW ─────────────────────────────────────────── */}
      <section className="bg-[#F5F7FA] dark:bg-[#131720] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2
              className="text-3xl md:text-[42px] font-black text-gray-900 dark:text-white mb-4"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                letterSpacing: '-0.025em',
              }}
            >
              Todo en un solo lugar
            </h2>
            <p
              className="text-base text-gray-500 dark:text-gray-400"
              style={{ fontFamily: '"DM Sans", system-ui' }}
            >
              Proyectos, tareas, hábitos, calendario y recordatorios — integrados y siempre al día.
            </p>
          </div>

          {/* Browser mockup */}
          <div
            className="shadow-2xl overflow-hidden"
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(0,0,0,0.07)',
            }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ backgroundColor: '#f0f1f3', borderBottom: '1px solid #e2e4e8' }}
            >
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              <div
                className="ml-3 flex-1 max-w-xs mx-auto h-5 rounded-md"
                style={{ background: '#e2e4e8' }}
              />
            </div>

            {/* App layout */}
            <div className="flex" style={{ height: '380px', backgroundColor: '#fff' }}>
              {/* Sidebar */}
              <div
                className="w-52 flex-shrink-0 p-3 space-y-0.5"
                style={{ backgroundColor: '#f8f9fb', borderRight: '1px solid #eaecf0' }}
              >
                <div className="flex items-center gap-2 px-3 py-2 mb-4">
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: '#283B56' }} />
                  <span
                    className="text-sm font-bold"
                    style={{ color: '#283B56', fontFamily: '"Bricolage Grotesque", system-ui' }}
                  >
                    Pendy
                  </span>
                </div>

                {[
                  { label: 'Inbox', dot: '#283B56', active: false },
                  { label: 'Hoy', dot: '#EC1E2A', active: true },
                  { label: 'Próximas', dot: '#3B82F6', active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium"
                    style={{
                      backgroundColor: item.active ? 'rgba(40,59,86,0.07)' : 'transparent',
                      color: item.active ? '#283B56' : '#6B7280',
                      fontFamily: '"DM Sans", system-ui',
                    }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.dot }} />
                    {item.label}
                  </div>
                ))}

                <div className="pt-5 pb-1.5 px-3">
                  <span
                    className="text-[10px] uppercase tracking-widest font-semibold text-gray-400"
                    style={{ fontFamily: '"DM Sans", system-ui' }}
                  >
                    Proyectos
                  </span>
                </div>
                {[
                  { label: 'Trabajo', color: '#3B82F6' },
                  { label: 'Personal', color: '#22C55E' },
                  { label: 'Compras', color: '#F59E0B' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-gray-500"
                    style={{ fontFamily: '"DM Sans", system-ui' }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-6 overflow-hidden">
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <div
                      className="text-lg font-bold text-gray-900"
                      style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
                    >
                      Hoy
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">4 tareas pendientes</div>
                  </div>
                  <div
                    className="text-xs text-gray-400"
                    style={{ fontFamily: '"DM Sans", system-ui' }}
                  >
                    Viernes, 28 feb
                  </div>
                </div>

                <div className="space-y-1.5">
                  {mockTasks.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border"
                      style={{
                        borderColor: task.done ? 'transparent' : '#eaecf0',
                        backgroundColor: task.done ? '#fafafa' : '#fff',
                        opacity: task.done ? 0.45 : 1,
                      }}
                    >
                      <div
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                        style={{
                          borderColor: task.done ? '#22C55E' : task.priority,
                          backgroundColor: task.done ? '#22C55E' : 'transparent',
                        }}
                      >
                        {task.done && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path
                              d="M1 3L3 5L7 1"
                              stroke="white"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className="text-sm flex-1 truncate"
                        style={{
                          fontFamily: '"DM Sans", system-ui',
                          color: task.done ? '#9CA3AF' : '#374151',
                          textDecoration: task.done ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </span>
                      {task.time && (
                        <span className="text-[11px] text-gray-400 tabular-nums">{task.time}</span>
                      )}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{
                          backgroundColor: `${task.priority}14`,
                          color: task.priority,
                          fontFamily: '"DM Sans", system-ui',
                        }}
                      >
                        {task.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-white dark:bg-[#0f1117]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="text-4xl md:text-[50px] font-black text-gray-900 dark:text-white mb-5"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                letterSpacing: '-0.025em',
              }}
            >
              Lo que necesitas.
              <br />
              <span className="text-gray-400 dark:text-gray-600">Nada que no uses.</span>
            </h2>
            <p
              className="text-base text-gray-500 dark:text-gray-400 max-w-md mx-auto"
              style={{ fontFamily: '"DM Sans", system-ui' }}
            >
              Funcionalidades que realmente importan para gestionar tu tiempo y tu energía.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const isInView = scrollY > 400
              const isHighlight = (feature as { highlight?: boolean }).highlight
              return (
                <div
                  key={index}
                  className={`group p-8 border transition-all duration-500 hover:shadow-lg hover:-translate-y-1 ${
                    isHighlight
                      ? 'dark:border-orange-900/40 border-orange-100 hover:border-orange-200 dark:hover:border-orange-800/50'
                      : 'dark:border-gray-800 border-gray-100 hover:border-gray-200 dark:hover:border-gray-700'
                  } ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{
                    borderRadius: '16px',
                    transitionDelay: isInView ? `${index * 60}ms` : '0ms',
                    backgroundColor: isHighlight ? 'rgba(249,115,22,0.03)' : undefined,
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                    style={{
                      backgroundColor: isHighlight ? 'rgba(249,115,22,0.1)' : 'rgba(40,59,86,0.07)',
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isHighlight ? '#F59E0B' : '#283B56' }}
                    />
                  </div>
                  <h3
                    className="text-base font-bold text-gray-900 dark:text-white mb-2"
                    style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed"
                    style={{ fontFamily: '"DM Sans", system-ui' }}
                  >
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#F5F7FA] dark:bg-[#131720]">
        <div className="max-w-3xl mx-auto">
          <div
            className="relative overflow-hidden p-14 text-center"
            style={{
              background: 'linear-gradient(135deg, #141e2d 0%, #1f2f45 100%)',
              borderRadius: '28px',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Accent glows */}
            <div
              className="absolute top-0 right-0 w-56 h-56 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at top right, rgba(236,30,42,0.12) 0%, transparent 60%)',
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-44 h-44 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at bottom left, rgba(255,255,255,0.03) 0%, transparent 60%)',
              }}
            />

            <div className="relative">
              <h2
                className="text-4xl md:text-5xl font-black text-white mb-4"
                style={{ fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.025em' }}
              >
                Empieza hoy.
              </h2>
              <p
                className="text-white/55 text-base mb-10 max-w-sm mx-auto leading-relaxed"
                style={{ fontFamily: '"DM Sans", system-ui' }}
              >
                Crea tu cuenta y construye el sistema que funciona para ti.
              </p>
              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white transition-all hover:scale-[1.03]"
                style={{
                  backgroundColor: '#EC1E2A',
                  borderRadius: '10px',
                  fontFamily: '"DM Sans", system-ui',
                  boxShadow: '0 0 48px rgba(236,30,42,0.35)',
                }}
              >
                Crear cuenta gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800/60 bg-white dark:bg-[#0f1117]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}pendy-logo.png`}
              alt="Pendy"
              className="w-6 h-6 rounded-md"
            />
            <span
              className="text-sm font-bold text-gray-700 dark:text-gray-300"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
            >
              Pendy
            </span>
          </div>
          <span className="text-gray-300 dark:text-gray-700 hidden md:inline">·</span>
          <p className="text-sm text-gray-400" style={{ fontFamily: '"DM Sans", system-ui' }}>
            © 2026. Hecho con{' '}
            <Heart size={11} className="inline text-red-500 fill-red-500 mx-0.5 -mt-0.5" /> para la
            productividad personal.
          </p>
        </div>
      </footer>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
    </div>
  )
}
