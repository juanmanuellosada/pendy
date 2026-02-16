import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <img src="/pendy-logo.png" alt="Pendy" className="h-20 w-20 rounded-xl" />
      <h1 className="mt-6 text-6xl font-bold" style={{ color: '#283B56' }}>404</h1>
      <p className="mt-2 text-lg" style={{ color: 'var(--text-secondary)' }}>
        Página no encontrada
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: '#283B56' }}
      >
        <Home size={18} />
        Ir al Inicio
      </Link>
    </div>
  )
}
