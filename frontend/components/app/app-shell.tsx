'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Sidebar, type CollapseMode } from './sidebar'
import { Topbar } from './topbar'
import { findNavItem, ROLE_STORAGE_KEY, type Role } from '@/lib/navigation'
import { adminUser, employeeUser } from '@/lib/mock-data'
import { listRequests } from '@/lib/services/request-service'
import { requestsChangedEvent } from '@/lib/services/request-events'

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

function useStoredRole(): Role | null {
  return useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem(ROLE_STORAGE_KEY) as Role | null) ?? null,
    () => null,
  )
}

const wideQuery = '(min-width: 1024px)'

function useIsWide() {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(wideQuery)
      mql.addEventListener('change', cb)
      return () => mql.removeEventListener('change', cb)
    },
    () => window.matchMedia(wideQuery).matches,
    () => true,
  )
}

const todayLabel = 'Selasa, 17 Nov 2026'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const storedRole = useStoredRole()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<CollapseMode>('auto')
  const [notificationCount, setNotificationCount] = useState(0)
  const isWide = useIsWide()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (wasOpen.current && !drawerOpen) menuButtonRef.current?.focus()
    wasOpen.current = drawerOpen
  }, [drawerOpen])

  const employeeArea =
    pathname.startsWith('/app/riwayat-kehadiran') ||
    pathname === '/app/beranda' ||
    (pathname === '/app/absensi' && storedRole !== 'admin')
  const adminArea =
    pathname.startsWith('/app/karyawan') ||
    pathname.startsWith('/app/master/') ||
    pathname === '/app/absensi/rekap' ||
    (pathname === '/app/absensi' && storedRole === 'admin')
  const role: Role =
    pathname === '/app' || adminArea ? 'admin' : employeeArea ? 'karyawan' : (storedRole ?? 'admin')
  const user = role === 'admin'
    ? adminUser
    : role === 'keuangan'
      ? { ...employeeUser, role: 'Tim Keuangan' }
      : role === 'pemilik'
        ? { name: 'Pemilik demo', role: 'Akses pemilik', initials: 'PD' }
        : employeeUser
  const title =
    pathname === '/app/penggajian/komponen'
      ? 'Komponen Gaji'
      : pathname === '/app/penggajian/proses'
      ? 'Proses Penggajian'
      : pathname === '/app/absensi/rekap'
      ? 'Rekap Absensi'
      : pathname.startsWith('/app/karyawan/') && pathname !== '/app/karyawan'
      ? 'Detail Karyawan'
      : findNavItem(pathname)?.label ?? 'HADIRPAY'

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  useEffect(() => {
    if (!pathname.startsWith('/app/karyawan') && !pathname.startsWith('/app/master/')) return
    const previousOverflowX = document.body.style.overflowX
    document.body.style.overflowX = 'hidden'
    return () => {
      document.body.style.overflowX = previousOverflowX
    }
  }, [pathname])

  function handleLogout() {
    localStorage.removeItem(ROLE_STORAGE_KEY)
    router.push('/login')
  }

  const expandedNow = mode === 'expanded' || (mode === 'auto' && isWide)

  useEffect(() => {
    let active = true
    async function refreshNotificationCount() {
      try {
        const requests = await listRequests()
        const pending = requests.filter(
          (request) =>
            request.status === 'Menunggu persetujuan' &&
            (role === 'admin' || request.employeeId === 'HP-0001'),
        ).length
        if (active) setNotificationCount(pending)
      } catch (error) {
        console.error('Jumlah pengajuan gagal dimuat.', error)
      }
    }

    const refresh = () => void refreshNotificationCount()
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener(requestsChangedEvent, refresh)
    return () => {
      active = false
      window.removeEventListener('storage', refresh)
      window.removeEventListener(requestsChangedEvent, refresh)
    }
  }, [role])

  function handleToggle() {
    setMode(expandedNow ? 'collapsed' : 'expanded')
  }

  const widthClass =
    mode === 'collapsed' ? 'md:w-24' : mode === 'expanded' ? 'md:w-72' : 'md:w-24 lg:w-72'

  return (
    <div className="min-h-dvh bg-surface">
      <div className="flex">
        <div
          className={`sticky top-0 hidden h-dvh shrink-0 p-4 pr-0 transition-[width] duration-200 md:block ${widthClass}`}
        >
          <Sidebar
            role={role}
            activeHref={pathname}
            mode={mode}
            expanded={expandedNow}
            onLogout={handleLogout}
            onToggle={handleToggle}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-border bg-surface px-4 py-4 sm:px-6 lg:px-8">
            <Topbar
              title={title}
              subtitle={todayLabel}
              user={user}
              notificationHref={role === 'pemilik' ? undefined : '/app/pengajuan'}
              notificationCount={notificationCount}
              notificationLabel={
                role === 'admin'
                  ? `${notificationCount} pengajuan perlu ditinjau`
                  : role === 'pemilik'
                    ? 'Notifikasi tidak tersedia untuk pemilik demo'
                    : `${notificationCount} pengajuan saya`
              }
              onMenu={() => setDrawerOpen(true)}
              menuButtonRef={menuButtonRef}
            />
          </div>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button
            type="button"
            className="absolute inset-0 bg-navy/60 animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          >
            <span className="sr-only">Tutup menu</span>
          </button>
          <div className="relative h-full w-[calc(100%-5rem)] max-w-80 p-3 animate-in slide-in-from-left duration-200">
            <Sidebar
              role={role}
              activeHref={pathname}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              autoFocus
              className="absolute top-5 -right-14 flex size-11 items-center justify-center rounded-full bg-white text-navy shadow-lg"
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">Tutup menu</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
