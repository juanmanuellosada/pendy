import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProjectEditor } from '@/components/projects/ProjectEditor'
import { useUIStore } from '@/stores/uiStore'
import { lazy, Suspense } from 'react'

// Lazy load pages
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('@/pages/app/DashboardPage'))
const InboxPage = lazy(() => import('@/pages/app/InboxPage'))
const TodayPage = lazy(() => import('@/pages/app/TodayPage'))
const UpcomingPage = lazy(() => import('@/pages/app/UpcomingPage'))
const ProjectPage = lazy(() => import('@/pages/app/ProjectPage'))
const SettingsPage = lazy(() => import('@/pages/app/SettingsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-4">
        <img src="/pendy-logo.png" alt="Pendy" className="h-16 w-16 rounded-xl animate-pulse" />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/auth/login" replace />

  return <>{children}</>
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/app" replace />

  return <>{children}</>
}

export default function App() {
  // Initialize theme
  useTheme()

  const { projectEditorOpen, setProjectEditorOpen } = useUIStore()

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Landing page */}
          <Route path="/" element={<LandingPage />} />

          {/* Auth routes */}
          <Route
            path="/auth/login"
            element={
              <AuthRoute>
                <LoginPage />
              </AuthRoute>
            }
          />
          <Route
            path="/auth/register"
            element={
              <AuthRoute>
                <RegisterPage />
              </AuthRoute>
            }
          />
          <Route
            path="/auth/forgot-password"
            element={
              <AuthRoute>
                <ForgotPasswordPage />
              </AuthRoute>
            }
          />

          {/* App routes */}
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="today" element={<TodayPage />} />
            <Route path="upcoming" element={<UpcomingPage />} />
            <Route path="project/:projectId" element={<ProjectPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>

      {/* Global modals */}
      <ProjectEditor
        open={projectEditorOpen}
        onClose={() => setProjectEditorOpen(false)}
      />
    </>
  )
}
