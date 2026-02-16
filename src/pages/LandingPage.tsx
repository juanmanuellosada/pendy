import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Zap, Calendar, Tag, ArrowRight } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function LandingPage() {
  const { isDark } = useTheme()
  const [scrollY, setScrollY] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)

    // Trigger entrance animations
    setTimeout(() => setIsVisible(true), 100)

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const features = [
    {
      icon: CheckCircle2,
      title: 'Organización Total',
      description: 'Proyectos ilimitados, subtareas anidadas y secciones personalizables.',
      delay: '0ms'
    },
    {
      icon: Zap,
      title: 'Entrada Rápida',
      description: 'Captura tareas al instante con procesamiento de lenguaje natural.',
      delay: '100ms'
    },
    {
      icon: Calendar,
      title: 'Fechas Inteligentes',
      description: 'Tareas recurrentes, recordatorios y vista de calendario integrada.',
      delay: '200ms'
    },
    {
      icon: Tag,
      title: 'Filtros Potentes',
      description: 'Etiquetas, prioridades y búsqueda avanzada para encontrar todo.',
      delay: '300ms'
    }
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-hidden relative transition-colors">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage: isDark
              ? `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`
              : `linear-gradient(#283B56 1px, transparent 1px), linear-gradient(90deg, #283B56 1px, transparent 1px)`,
            backgroundSize: '64px 64px'
          }}
        />

        {/* Geometric accent - top right */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(236, 30, 42, 0.08) 0%, transparent 70%)',
            transform: `translateY(${scrollY * 0.3}px)`
          }}
        />

        {/* Geometric accent - bottom left */}
        <div
          className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(40, 59, 86, 0.06) 0%, transparent 70%)',
            transform: `translateY(${-scrollY * 0.2}px)`
          }}
        />
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center space-y-12">
            {/* Logo */}
            <div
              className={`inline-flex items-center justify-center transition-all duration-1000 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <img
                src="/pendy-logo.png"
                alt="Pendy"
                className="w-24 h-24 drop-shadow-2xl rounded-xl"
                style={{ animationDelay: '0ms' }}
              />
            </div>

            {/* Headline */}
            <div className="space-y-6">
              <h1
                className={`text-6xl md:text-8xl font-black tracking-tight transition-all duration-1000 delay-100 text-gray-900 dark:text-white ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  letterSpacing: '-0.02em'
                }}
              >
                Organiza Todo.
                <br />
                <span className="relative inline-block">
                  Logra Más.
                  <div
                    className="absolute -bottom-2 left-0 w-full h-3 -z-10"
                    style={{ backgroundColor: 'rgba(236, 30, 42, 0.2)' }}
                  />
                </span>
              </h1>

              <p
                className={`text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed transition-all duration-1000 delay-200 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                La herramienta de gestión de tareas que necesitas.
                <br />
                Simple, potente y completamente tuya.
              </p>
            </div>

            {/* CTA Buttons */}
            <div
              className={`flex flex-col sm:flex-row gap-4 items-center justify-center transition-all duration-1000 delay-300 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <Link
                to="/auth/register"
                className="group relative px-10 py-5 text-lg font-bold text-white overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                style={{
                  backgroundColor: '#EC1E2A',
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  borderRadius: '12px'
                }}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Empezar Gratis
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>

              <Link
                to="/auth/login"
                className="px-10 py-5 text-lg font-bold transition-all hover:scale-105 text-gray-900 dark:text-white border-2 border-gray-900 dark:border-white"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  borderRadius: '12px'
                }}
              >
                Iniciar Sesión
              </Link>
            </div>

            {/* Scroll indicator */}
            <div
              className={`pt-20 transition-all duration-1000 delay-500 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="inline-flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 animate-bounce">
                <span className="text-sm uppercase tracking-widest" style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
                  Descubre más
                </span>
                <div className="w-0.5 h-12 bg-gradient-to-b from-gray-400 dark:from-gray-500 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Section header */}
          <div className="text-center mb-20">
            <h2
              className="text-4xl md:text-6xl font-black mb-6 text-gray-900 dark:text-white"
              style={{
                fontFamily: '"Outfit", system-ui, sans-serif',
                letterSpacing: '-0.02em'
              }}
            >
              Productividad Sin Límites
            </h2>
            <p
              className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
              style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
            >
              Todo lo que necesitas para mantener tu vida organizada en un solo lugar
            </p>
          </div>

          {/* Features grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              const isInView = scrollY > 300

              return (
                <div
                  key={index}
                  className={`group relative p-10 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 transition-all duration-700 hover:scale-[1.02] hover:shadow-2xl ${
                    isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{
                    borderRadius: '20px',
                    transitionDelay: isInView ? feature.delay : '0ms'
                  }}
                >
                  {/* Hover accent */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(236, 30, 42, 0.05) 0%, transparent 100%)',
                      borderRadius: '20px'
                    }}
                  />

                  <div className="relative space-y-4">
                    {/* Icon */}
                    <div
                      className="inline-flex p-4 rounded-2xl transition-transform group-hover:scale-110"
                      style={{ backgroundColor: 'rgba(236, 30, 42, 0.1)' }}
                    >
                      <Icon className="w-8 h-8" style={{ color: '#EC1E2A' }} strokeWidth={2.5} />
                    </div>

                    {/* Content */}
                    <h3
                      className="text-2xl font-bold text-gray-900 dark:text-white"
                      style={{
                        fontFamily: '"Outfit", system-ui, sans-serif'
                      }}
                    >
                      {feature.title}
                    </h3>

                    <p
                      className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed"
                      style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
                    >
                      {feature.description}
                    </p>
                  </div>

                  {/* Corner accent */}
                  <div
                    className="absolute top-0 right-0 w-24 h-24 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle at top right, rgba(236, 30, 42, 0.1) 0%, transparent 70%)',
                      borderRadius: '0 20px 0 0'
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="relative p-16 overflow-hidden bg-gray-900 dark:bg-gray-800"
            style={{
              borderRadius: '32px'
            }}
          >
            {/* Background pattern */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `linear-gradient(white 2px, transparent 2px), linear-gradient(90deg, white 2px, transparent 2px)`,
                backgroundSize: '48px 48px'
              }}
            />

            <div className="relative space-y-8">
              <h2
                className="text-4xl md:text-5xl font-black text-white"
                style={{
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  letterSpacing: '-0.02em'
                }}
              >
                Empieza a Organizar Tu Vida Hoy
              </h2>

              <p
                className="text-xl text-white/80 max-w-2xl mx-auto"
                style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
              >
                Únete a miles de personas que ya están siendo más productivas con Pendy
              </p>

              <Link
                to="/auth/register"
                className="inline-flex items-center gap-2 px-10 py-5 text-lg font-bold transition-all hover:scale-105 hover:shadow-2xl"
                style={{
                  backgroundColor: '#EC1E2A',
                  color: 'white',
                  fontFamily: '"Outfit", system-ui, sans-serif',
                  borderRadius: '12px'
                }}
              >
                Crear Cuenta Gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p
            className="text-gray-500 dark:text-gray-400"
            style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}
          >
            © 2026 Pendy. Hecho con ❤️ para mejorar tu productividad.
          </p>
        </div>
      </footer>

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
