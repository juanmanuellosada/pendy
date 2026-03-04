import { useEffect, useRef, useState } from 'react'
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
  MessageSquare,
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
  {
    icon: MessageSquare,
    title: 'Comentarios y adjuntos',
    description:
      'Añade notas con texto enriquecido y archivos a cada tarea. Todo el contexto donde lo necesitas.',
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
  const [isVisible, setIsVisible] = useState(false)
  const [featuresInView, setFeaturesInView] = useState(false)
  const featuresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 120)
  }, [])

  // IntersectionObserver for features section (Step 3)
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setFeaturesInView(true)
      return
    }

    const el = featuresRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting) {
          setFeaturesInView(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    observer.observe(el)
    return () => observer.disconnect()
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

        {/* Nav — Step 2: responsive padding + CTA sizing */}
        <nav className="relative z-10 flex items-center justify-between px-4 md:px-8 py-6">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}pendy-logo.png`}
              alt="Pendy"
              className="w-8 h-8 rounded-lg"
            />
            <span className="font-heading text-white font-bold text-xl tracking-tight">Pendy</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              to="/auth/login"
              className="font-body px-3 md:px-5 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth/register"
              className="font-body px-4 md:px-5 py-2 md:py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{
                backgroundColor: '#EC1E2A',
                borderRadius: '8px',
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
              <span className="font-body text-white/50 text-sm">En desarrollo activo</span>
            </div>

            {/* Headline */}
            <h1
              className={`font-display font-black text-white leading-[0.95] mb-8 transition-all duration-700 delay-100 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{
                fontSize: 'clamp(56px, 10vw, 96px)',
                letterSpacing: '-0.03em',
              }}
            >
              Tu sistema.
              <br />
              <span style={{ color: '#EC1E2A' }}>Sin ruido.</span>
            </h1>

            <p
              className={`font-body text-lg md:text-xl text-white/55 max-w-lg mx-auto leading-relaxed mb-12 transition-all duration-700 delay-200 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              Gestión de tareas y hábitos pensada para la claridad. Proyectos, calendario, rutinas y
              recordatorios — todo integrado.
            </p>

            {/* CTAs — Step 2: responsive padding */}
            <div
              className={`flex flex-col sm:flex-row gap-4 items-center justify-center transition-all duration-700 delay-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <Link
                to="/auth/register"
                className="font-body group flex items-center gap-2 px-7 py-3.5 md:px-9 md:py-4 text-base font-bold text-white transition-all hover:scale-[1.03]"
                style={{
                  backgroundColor: '#EC1E2A',
                  borderRadius: '10px',
                  boxShadow: '0 0 48px rgba(236,30,42,0.28)',
                }}
              >
                Empezar gratis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/auth/login"
                className="font-body flex items-center gap-2 px-7 py-3.5 md:px-9 md:py-4 text-base font-medium text-white/55 hover:text-white/80 transition-colors"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll hint — Step 2: hidden on mobile */}
        <div className="relative z-10 hidden md:flex justify-center pb-10 opacity-30">
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <span className="font-body text-white text-[10px] uppercase tracking-[0.2em]">
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
              className="font-display text-3xl md:text-[42px] font-black text-gray-900 dark:text-white mb-4"
              style={{ letterSpacing: '-0.025em' }}
            >
              Todo en un solo lugar
            </h2>
            <p className="font-body text-base text-gray-500 dark:text-gray-400">
              Proyectos, tareas, hábitos, calendario y recordatorios — integrados y siempre al día.
            </p>
          </div>

          {/* Browser mockup — Step 4: aria-hidden, responsive */}
          <div
            className="shadow-2xl overflow-hidden"
            style={{
              borderRadius: '18px',
              border: '1px solid rgba(0,0,0,0.07)',
            }}
            aria-hidden="true"
          >
            {/* Window chrome — Step 6: dark mode */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#f0f1f3] dark:bg-[#2a2a2a] border-b border-[#e2e4e8] dark:border-[#3a3a3a]">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]" />
              <div className="ml-3 flex-1 max-w-xs mx-auto h-5 rounded-md bg-[#e2e4e8] dark:bg-[#3a3a3a]" />
            </div>

            {/* App layout — Step 4: responsive height, Step 6: dark mode */}
            <div className="flex h-auto min-h-[280px] md:h-[380px] bg-white dark:bg-[#1a1f2b]">
              {/* Sidebar — Step 4: hidden on mobile */}
              <div className="hidden md:block w-52 flex-shrink-0 p-3 space-y-0.5 bg-[#f8f9fb] dark:bg-[#161b26] border-r border-[#eaecf0] dark:border-[#2a3244]">
                <div className="flex items-center gap-2 px-3 py-2 mb-4">
                  <div className="w-5 h-5 rounded" style={{ backgroundColor: '#283B56' }} />
                  <span className="font-heading text-sm font-bold text-[#283B56] dark:text-white">
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
                    className={`font-body flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium ${
                      item.active
                        ? 'bg-[rgba(40,59,86,0.07)] dark:bg-[rgba(255,255,255,0.08)] text-[#283B56] dark:text-white'
                        : 'text-[#6B7280] dark:text-[#9CA3AF]'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.dot }} />
                    {item.label}
                  </div>
                ))}

                <div className="pt-5 pb-1.5 px-3">
                  <span className="font-body text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500">
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
                    className="font-body flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-gray-500 dark:text-gray-400"
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
              <div className="flex-1 p-4 md:p-6 overflow-hidden">
                <div className="flex items-baseline justify-between mb-5">
                  <div>
                    <div className="font-heading text-lg font-bold text-gray-900 dark:text-white">
                      Hoy
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      4 tareas pendientes
                    </div>
                  </div>
                  <div className="font-body text-xs text-gray-400 dark:text-gray-500">
                    Viernes, 28 feb
                  </div>
                </div>

                <div className="space-y-1.5">
                  {mockTasks.map((task, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                        task.done
                          ? 'border-transparent bg-[#fafafa] dark:bg-[#1e2433] opacity-45'
                          : 'border-[#eaecf0] dark:border-[#2a3244] bg-white dark:bg-[#1a1f2b]'
                      }`}
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
                        className={`font-body text-sm flex-1 truncate ${
                          task.done
                            ? 'text-[#9CA3AF] line-through'
                            : 'text-[#374151] dark:text-[#d1d5db]'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.time && (
                        <span className="text-[11px] text-gray-400 tabular-nums">{task.time}</span>
                      )}
                      <span
                        className="font-body text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{
                          backgroundColor: `${task.priority}14`,
                          color: task.priority,
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
      <section className="py-28 px-6 bg-white dark:bg-[#0f1117]" ref={featuresRef}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2
              className="font-display text-4xl md:text-[50px] font-black text-gray-900 dark:text-white mb-5"
              style={{ letterSpacing: '-0.025em' }}
            >
              Lo que necesitas.
              <br />
              <span className="text-gray-400 dark:text-gray-600">Nada que no uses.</span>
            </h2>
            <p className="font-body text-base text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Funcionalidades que realmente importan para gestionar tu tiempo y tu energía.
            </p>
          </div>

          {/* Step 8: grid 4 cols on lg, 8 features */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const isHighlight = (feature as { highlight?: boolean }).highlight
              return (
                <div
                  key={index}
                  role="article"
                  tabIndex={0}
                  className={`group p-8 border transition-all duration-500 hover:shadow-lg hover:-translate-y-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#283B56] ${
                    isHighlight
                      ? 'dark:border-orange-900/40 border-orange-100 hover:border-orange-200 dark:hover:border-orange-800/50'
                      : 'dark:border-gray-800 border-gray-100 hover:border-gray-200 dark:hover:border-gray-700'
                  } ${featuresInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{
                    transitionDelay: featuresInView ? `${index * 60}ms` : '0ms',
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
                  <h3 className="font-heading text-base font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="font-body text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / STATS — Step 10 ─────────────────────── */}
      <section className="py-10 px-6 bg-white dark:bg-[#0f1117] border-t border-gray-100 dark:border-gray-800/50">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {[
            { icon: Calendar, text: 'Calendario integrado' },
            { icon: Flame, text: 'Hábitos con rachas' },
            { icon: Zap, text: 'Captura con lenguaje natural' },
            { icon: Bell, text: 'Modo offline' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
              <item.icon className="w-3.5 h-3.5" />
              <span className="font-body text-sm">{item.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-[#F5F7FA] dark:bg-[#131720]">
        <div className="max-w-3xl mx-auto">
          <div
            className="relative overflow-hidden p-10 md:p-14 text-center"
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
                className="font-display text-4xl md:text-5xl font-black text-white mb-4"
                style={{ letterSpacing: '-0.025em' }}
              >
                Empieza hoy.
              </h2>
              <p className="font-body text-white/55 text-base mb-10 max-w-sm mx-auto leading-relaxed">
                Crea tu cuenta y construye el sistema que funciona para ti.
              </p>
              <Link
                to="/auth/register"
                className="font-body inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white transition-all hover:scale-[1.03]"
                style={{
                  backgroundColor: '#EC1E2A',
                  borderRadius: '10px',
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

      {/* ── FOOTER — Step 9: links ─────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-gray-100 dark:border-gray-800/60 bg-white dark:bg-[#0f1117]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}pendy-logo.png`}
              alt="Pendy"
              className="w-6 h-6 rounded-md"
            />
            <span className="font-heading text-sm font-bold text-gray-700 dark:text-gray-300">
              Pendy
            </span>
          </div>
          <span className="text-gray-300 dark:text-gray-700 hidden md:inline">·</span>
          <p className="font-body text-sm text-gray-400">
            © 2026. Hecho con{' '}
            <Heart size={11} className="inline text-red-500 fill-red-500 mx-0.5 -mt-0.5" /> para la
            productividad personal.
          </p>
          <span className="text-gray-300 dark:text-gray-700 hidden md:inline">·</span>
          <div className="flex items-center gap-4">
            <span className="font-body text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
              Privacidad
            </span>
            <span className="font-body text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
              Términos
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
