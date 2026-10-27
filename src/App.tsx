import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Logo } from '@/components/shared/brand'
import { Button } from '@/components/ui/button'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { Role } from '@/lib/types'
import { LoginPage } from '@/pages/login'
import { ForbiddenPage, NotFoundPage } from '@/pages/not-found'

const DashboardPage = lazy(() =>
  import('@/pages/dashboard').then((module) => ({ default: module.DashboardPage })),
)
const SessionsPage = lazy(() =>
  import('@/pages/sesi').then((module) => ({ default: module.SessionsPage })),
)
const SessionDetailPage = lazy(() =>
  import('@/pages/sesi-detail').then((module) => ({ default: module.SessionDetailPage })),
)
const MembersPage = lazy(() =>
  import('@/pages/anggota').then((module) => ({ default: module.MembersPage })),
)
const GradesPage = lazy(() =>
  import('@/pages/nilai').then((module) => ({ default: module.GradesPage })),
)
const DocumentationPage = lazy(() =>
  import('@/pages/dokumentasi').then((module) => ({ default: module.DocumentationPage })),
)
const PermitsPage = lazy(() =>
  import('@/pages/perizinan').then((module) => ({ default: module.PermitsPage })),
)
const ReportsPage = lazy(() =>
  import('@/pages/laporan').then((module) => ({ default: module.ReportsPage })),
)
const EskulListPage = lazy(() =>
  import('@/pages/eskul-list').then((module) => ({ default: module.EskulListPage })),
)
const EskulDetailPage = lazy(() =>
  import('@/pages/eskul-detail').then((module) => ({ default: module.EskulDetailPage })),
)
const AdminPage = lazy(() =>
  import('@/pages/admin').then((module) => ({ default: module.AdminPage })),
)

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Memuat halaman...
      </div>
    </div>
  )
}

function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
      <Logo />
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        Menghubungkan ke database...
      </div>
    </div>
  )
}

function BootErrorScreen() {
  const bootError = useAppStore((state) => state.bootError)
  const init = useAppStore((state) => state.init)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
      <Logo />
      <span className="mt-10 flex size-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-foreground">
        Server belum terhubung
      </h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {bootError ?? 'API SIMSKUL tidak dapat dijangkau.'}
      </p>
      <p className="mt-3 max-w-md text-[11px] leading-relaxed text-muted-foreground/80">
        Jalankan <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">npm run dev</code>{' '}
        untuk menyalakan API dan web, atau{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">npm start</code> setelah{' '}
        <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">npm run build</code>.
      </p>
      <Button className="mt-6" onClick={() => void init()}>
        <RefreshCw />
        Coba lagi
      </Button>
    </div>
  )
}

function BootGate({ children }: { children: ReactNode }) {
  const status = useAppStore((state) => state.status)
  const init = useAppStore((state) => state.init)

  useEffect(() => {
    void init()
  }, [init])

  if (status === 'loading') return <BootScreen />
  if (status === 'error') return <BootErrorScreen />
  return children
}

function SuspendedPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <ForbiddenPage />
  return children
}

function HomeRoute() {
  const user = useCurrentUser()
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  return (
    <SuspendedPage>
      <DashboardPage />
    </SuspendedPage>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomeRoute />} />
        <Route
          path="sesi"
          element={
            <RequireRole roles={['pelatih', 'ketua', 'wakasek']}>
              <SuspendedPage>
                <SessionsPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="sesi/:id"
          element={
            <RequireRole roles={['pelatih', 'ketua', 'wakasek']}>
              <SuspendedPage>
                <SessionDetailPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="anggota"
          element={
            <RequireRole roles={['pelatih', 'ketua']}>
              <SuspendedPage>
                <MembersPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="nilai"
          element={
            <RequireRole roles={['pelatih']}>
              <SuspendedPage>
                <GradesPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="dokumentasi"
          element={
            <RequireRole roles={['pelatih', 'ketua', 'wakasek']}>
              <SuspendedPage>
                <DocumentationPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="perizinan"
          element={
            <RequireRole roles={['pelatih', 'ketua', 'wakasek']}>
              <SuspendedPage>
                <PermitsPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="laporan"
          element={
            <RequireRole roles={['wakasek', 'admin']}>
              <SuspendedPage>
                <ReportsPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="eskul"
          element={
            <RequireRole roles={['wakasek', 'admin']}>
              <SuspendedPage>
                <EskulListPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="eskul/:id"
          element={
            <RequireRole roles={['wakasek', 'admin']}>
              <SuspendedPage>
                <EskulDetailPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route
          path="admin"
          element={
            <RequireRole roles={['admin']}>
              <SuspendedPage>
                <AdminPage />
              </SuspendedPage>
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <BootGate>
        <AppRoutes />
      </BootGate>
    </HashRouter>
  )
}
