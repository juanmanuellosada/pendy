import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const registerSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

export default function RegisterPage() {
  const { signUp, signInWithGoogle } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null)
      await signUp(data.email, data.password, data.fullName)
      setSuccess(true)
    } catch {
      setError('Error al crear la cuenta. Intenta con otro email.')
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle()
    } catch {
      setError('Error al registrarse con Google')
    }
  }

  const bgStyles = {
    backgroundColor: '#16202f',
  }

  const cardStyles = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '36px',
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={bgStyles}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
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
            style={{ background: 'radial-gradient(ellipse at top right, rgba(236,30,42,0.09) 0%, transparent 65%)' }}
          />
        </div>
        <div className="relative z-10 w-full max-w-[400px] text-center" style={cardStyles}>
          <div
            className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            <CheckCircle2 size={26} className="text-emerald-400" />
          </div>
          <h1
            className="text-2xl font-black text-white mb-2"
            style={{ fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em' }}
          >
            ¡Cuenta creada!
          </h1>
          <p
            className="text-sm mb-8"
            style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui', lineHeight: 1.6 }}
          >
            Revisa tu email para confirmar tu cuenta antes de ingresar.
          </p>
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: '#EC1E2A',
              fontFamily: '"DM Sans", system-ui',
              boxShadow: '0 0 32px rgba(236,30,42,0.25)',
            }}
          >
            Ir a Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={bgStyles}>
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
          style={{ background: 'radial-gradient(ellipse at top right, rgba(236,30,42,0.09) 0%, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[350px] h-[350px]"
          style={{ background: 'radial-gradient(ellipse at bottom left, rgba(40,59,86,0.35) 0%, transparent 65%)' }}
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
          <img src="/pendy-logo.png" alt="Pendy" className="w-7 h-7 rounded-lg" />
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
        <div className="w-full max-w-[400px]" style={cardStyles}>
          {/* Header */}
          <div className="mb-8">
            <h1
              className="text-2xl font-black text-white mb-1"
              style={{ fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em' }}
            >
              Crear cuenta
            </h1>
            <p
              className="text-sm text-white/45"
              style={{ fontFamily: '"DM Sans", system-ui' }}
            >
              Empieza a organizar tus tareas
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
            {[
              { id: 'fullName', label: 'Nombre completo', type: 'text', placeholder: 'Juan Pérez', autoComplete: 'name', error: errors.fullName },
              { id: 'email', label: 'Email', type: 'email', placeholder: 'tu@email.com', autoComplete: 'email', error: errors.email },
            ].map(({ id, label, type, placeholder, autoComplete, error: fieldError }) => (
              <div key={id}>
                <label
                  htmlFor={id}
                  className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui' }}
                >
                  {label}
                </label>
                <input
                  id={id}
                  type={type}
                  autoComplete={autoComplete}
                  {...register(id as keyof RegisterForm)}
                  placeholder={placeholder}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${fieldError ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    fontFamily: '"DM Sans", system-ui',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.2)' }}
                  onBlur={(e) => { e.target.style.borderColor = fieldError ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)' }}
                />
                {fieldError && (
                  <p className="mt-1.5 text-xs" style={{ color: '#f87171', fontFamily: '"DM Sans", system-ui' }}>
                    {fieldError.message}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui' }}
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${errors.password ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    fontFamily: '"DM Sans", system-ui',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.2)' }}
                  onBlur={(e) => { e.target.style.borderColor = errors.password ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)' }}
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
                <p className="mt-1.5 text-xs" style={{ color: '#f87171', fontFamily: '"DM Sans", system-ui' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.45)', fontFamily: '"DM Sans", system-ui' }}
              >
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                {...register('confirmPassword')}
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${errors.confirmPassword ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  fontFamily: '"DM Sans", system-ui',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.2)' }}
                onBlur={(e) => { e.target.style.borderColor = errors.confirmPassword ? 'rgba(236,30,42,0.5)' : 'rgba(255,255,255,0.08)' }}
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs" style={{ color: '#f87171', fontFamily: '"DM Sans", system-ui' }}>
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 mt-2"
              style={{
                backgroundColor: '#EC1E2A',
                fontFamily: '"DM Sans", system-ui',
                boxShadow: '0 0 32px rgba(236,30,42,0.25)',
              }}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Crear cuenta'
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
                style={{ color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui' }}
              >
                o continúa con
              </span>
            </div>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-medium transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.75)',
              fontFamily: '"DM Sans", system-ui',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)' }}
          >
            <GoogleIcon />
            Google
          </button>

          {/* Footer link */}
          <p
            className="text-center text-xs mt-6"
            style={{ color: 'rgba(255,255,255,0.3)', fontFamily: '"DM Sans", system-ui' }}
          >
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/auth/login"
              className="font-semibold transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'white')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
            >
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
