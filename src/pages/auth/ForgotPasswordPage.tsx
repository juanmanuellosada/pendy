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
  } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  })

  const onSubmit = async (data: ForgotForm) => {
    try {
      setError(null)
      await resetPassword(data.email)
      setSuccess(true)
    } catch {
      setError('Error al enviar el email de recuperación')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="w-full max-w-md space-y-8 rounded-2xl p-8 shadow-lg" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        <div className="text-center">
          <img src="/pendy-logo.png" alt="Pendy" className="mx-auto h-16 w-16 rounded-xl" />
          <h1 className="mt-4 text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Recuperar Contraseña
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Te enviaremos un email para restablecer tu contraseña
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <Mail size={28} className="text-green-600" />
            </div>
            <p style={{ color: 'var(--text-primary)' }}>
              Revisa tu bandeja de entrada. Te enviamos un enlace para restablecer tu contraseña.
            </p>
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              style={{ color: '#283B56' }}
            >
              <ArrowLeft size={16} />
              Volver a Iniciar Sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="mt-1 block w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  borderColor: errors.email ? '#EC1E2A' : 'var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                placeholder="tu@email.com"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#283B56' }}
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Enviar Email de Recuperación'
              )}
            </button>

            <div className="text-center">
              <Link
                to="/auth/login"
                className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ArrowLeft size={16} />
                Volver a Iniciar Sesión
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
