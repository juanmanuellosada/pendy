import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

type LoginForm = z.infer<typeof loginSchema>

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
)

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null)
      await signIn(data.email, data.password)
      navigate('/app')
    } catch {
      setError('Email o contraseña incorrectos')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch {
      setError('Error al iniciar sesión con Google')
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#16202f' }}>
      {/* Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)`,
            backgroundSize: '72px 72px',
          }}
        />
        <div
          className="absolute top-0 right-0 w-[400px] h-[400px]"
          style={{
            background:
              'radial-gradient(ellipse at top right, rgba(236,30,42,0.09) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-[350px] h-[350px]"
          style={{
            background:
              'radial-gradient(ellipse at bottom left, rgba(40,59,86,0.35) 0%, transparent 65%)',
          }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link
          to="/"
          className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
          style={{ fontFamily: '"DM Sans", system-ui' }}
        >
          <ArrowLeft size={15} />
          Volver
        </Link>
        <div className="flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}pendy-logo.png`}
            alt="Pendy"
            className="w-7 h-7 rounded-lg"
          />
          <span
            className="text-white font-bold text-base tracking-tight"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui' }}
          >
            Pendy
          </span>
        </div>
        <div className="w-20" />
      </nav>

      {/* Card */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div
          className="w-full max-w-[400px]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            padding: '36px',
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-2xl font-black text-white mb-1"
              style={{ fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em' }}
            >
              Bienvenido de vuelta
            </h1>
            <p className="text-sm text-white/45" style={{ fontFamily: '"DM Sans", system-ui' }}>
              Ingresa tus datos para continuar
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              className="mb-5 rounded-xl px-4 py-3 text-sm"
              style={{
                background: 'rgba(236,30,42,0.1)',
                border: '1px solid rgba(236,30,42,0.2)',
                color: '#f87171',
                fontFamily: '"DM Sans", system-ui',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                placeholder="tu@email.com"
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${errors.email ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  fontFamily: '"DM Sans", system-ui',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.2)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.email
                    ? 'rgba(236,30,42,0.5)'
                    : 'rgba(255,255,255,0.08)'
                }}
              />
              {errors.email && (
                <p
                  className="mt-1.5 text-xs"
                  style={{ color: '#f87171', fontFamily: '"DM Sans", system-ui' }}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui' }}
                >
                  Contraseña
                </label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${errors.password ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    fontFamily: '"DM Sans", system-ui',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.2)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.password
                      ? 'rgba(236,30,42,0.5)'
                      : 'rgba(255,255,255,0.08)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p
                  className="mt-1.5 text-xs"
                  style={{ color: '#f87171', fontFamily: '"DM Sans", system-ui' }}
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 mt-2"
              style={{
                backgroundColor: 'var(--color-accent)',
                fontFamily: '"DM Sans", system-ui',
                boxShadow: '0 0 32px rgba(236,30,42,0.25)',
              }}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }} />
            </div>
            <div className="relative flex justify-center">
              <span
                className="px-3 text-xs"
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: '"DM Sans", system-ui',
                }}
              >
                o continúa con
              </span>
            </div>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.75)',
              fontFamily: '"DM Sans", system-ui',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
            }}
          >
            <GoogleIcon />
            Google
          </button>

          {/* Footer link */}
          <p
            className="text-center text-xs mt-6"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui' }}
          >
            ¿No tienes cuenta?{' '}
            <Link
              to="/auth/register"
              className="font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            >
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
