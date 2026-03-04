import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = async (data: ForgotForm) => {
    try {
      setError(null)
      await resetPassword(data.email)
      setSuccess(true)
    } catch {
      setError('Error al enviar el email de recuperación')
    }
  }

  const bgStyles = { backgroundColor: '#16202f' }
  const cardStyles = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '20px',
    padding: '36px',
  }

  const Background = () => (
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
  )

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={bgStyles}>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=DM+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <Background />
        <div className="relative z-10 w-full max-w-[400px] text-center" style={cardStyles}>
          <div
            className="mx-auto mb-6 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <Mail size={24} className="text-blue-400" />
          </div>
          <h1
            className="text-2xl font-black text-white mb-2"
            style={{ fontFamily: '"Fraunces", Georgia, serif', letterSpacing: '-0.02em' }}
          >
            Email enviado
          </h1>
          <p
            className="text-sm mb-8"
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontFamily: '"DM Sans", system-ui',
              lineHeight: 1.6,
            }}
          >
            Revisa tu bandeja de entrada. Te enviamos un enlace para restablecer tu contraseña.
          </p>
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)', fontFamily: '"DM Sans", system-ui' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
          >
            <ArrowLeft size={14} />
            Volver a Iniciar Sesión
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
      <Background />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link
          to="/auth/login"
          className="flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm"
          style={{ fontFamily: '"DM Sans", system-ui' }}
        >
          <ArrowLeft size={15} />
          Volver
        </Link>
        <div className="flex items-center gap-2.5">
          <div
            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <div className="w-3 h-3 rounded-sm border border-white/60" />
          </div>
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
              Recuperar contraseña
            </h1>
            <p className="text-sm text-white/45" style={{ fontFamily: '"DM Sans", system-ui' }}>
              Te enviamos un enlace a tu email
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
              style={{
                backgroundColor: 'var(--color-accent)',
                fontFamily: '"DM Sans", system-ui',
                boxShadow: '0 0 32px rgba(236,30,42,0.25)',
              }}
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Enviar enlace de recuperación'
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-1.5 text-xs transition-colors"
                style={{ color: 'rgba(255,255,255,0.35)', fontFamily: '"DM Sans", system-ui' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.65)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
              >
                <ArrowLeft size={13} />
                Volver a Iniciar Sesión
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
