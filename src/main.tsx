import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { Toaster } from 'sonner'
import App from './App'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { queryPersister } from '@/lib/queryPersister'
import './index.css'

// Cuando Vite no puede cargar un chunk (404 tras nuevo deploy con hash distinto),
// recarga la página automáticamente para obtener el index.html actualizado.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

const MS_24H = 1000 * 60 * 60 * 24

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      gcTime: MS_24H,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: MS_24H }}
      >
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
            },
          }}
        />
      </PersistQueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
