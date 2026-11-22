'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { Sidebar, type CollapseMode } from './sidebar'
import { Topbar } from './topbar'
import { canRoleAccessPath, findNavItem, isRole, ROLE_STORAGE_KEY, roleChangedEvent, type Role } from '@/lib/navigation'
import { adminUser, employeeUser } from '@/lib/mock-data'
import type { DemoSettings } from '@/lib/mock/settings'
import { getDemoSettings, settingsChangedEvent } from '@/lib/services/pengaturan.service'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { useAuth } from '@/lib/auth/auth-provider'
import { config } from '@/lib/config'
import { logout as logoutService } from '@/lib/services/auth.service'
import { getAdminDashboard, getEmployeeDashboard } from '@/lib/services/dashboard.service'
import { formatTanggal } from '@/lib/format'

function subscribeRole(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(roleChangedEvent, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(roleChangedEvent, callback)
  }
}

function useStoredRole(): Role | null {
  return useSyncExternalStore(
    subscribeRole,
    () => {
      const stored = localStorage.getItem(ROLE_STORAGE_KEY)
      return isRole(stored) ? stored : null
    },
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

const todayLabel = 'Rabu, 18 Nov 2026'
const serverDateFormat = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const storedRole = useStoredRole()
  const auth = useAuth()
  const role = config.mock.auth ? storedRole : auth.role
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode, setMode] = useState<CollapseMode>('auto')
  const [settings, setSettings] = useState<DemoSettings | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [topbarDate, setTopbarDate] = useState(config.mock.dashboard ? todayLabel : '')
  const isWide = useIsWide()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const requiredMenu = pathname.startsWith('/app/absensi') || pathname.startsWith('/app/riwayat-kehadiran')
    ? 'absensi'
    : pathname.startsWith('/app/pengajuan')
      ? 'pengajuan'
      : pathname.startsWith('/app/karyawan') || pathname.startsWith('/app/master')
        ? 'karyawan'
        : pathname.startsWith('/app/penggajian') || pathname.startsWith('/app/slip-gaji')
          ? 'penggajian'
          : pathname.startsWith('/app/akuntansi')
            ? 'akuntansi'
            : pathname.startsWith('/app/laporan')
              ? 'laporan'
              : pathname.startsWith('/app/pengaturan')
                ? 'pengaturan'
                : pathname === '/app' || pathname === '/app/beranda'
                  ? 'dashboard'
                  : null
  const canAccess = role
    ? canRoleAccessPath(role, pathname) &&
      (config.mock.auth || !requiredMenu || auth.menuAccess.includes(requiredMenu))
    : false

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || (!config.mock.auth && auth.loading)) return
    if (!role) {
      router.replace('/login')
      return
    }
    if (!canAccess) router.replace('/403')
  }, [hydrated, role, canAccess, router, auth.loading])

  useEffect(() => {
    if (wasOpen.current && !drawerOpen) menuButtonRef.current?.focus()
    wasOpen.current = drawerOpen
  }, [drawerOpen])

  useEffect(() => {
    if (!config.mock.pengaturan) return
    let active = true
    async function loadSettings() {
      try {
        const value = await getDemoSettings()
        if (active) setSettings(value)
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : 'Pengaturan perusahaan gagal dimuat.')
      }
    }
    void loadSettings()
    window.addEventListener('storage', loadSettings)
    window.addEventListener(settingsChangedEvent, loadSettings)
    return () => {
      active = false
      window.removeEventListener('storage', loadSettings)
      window.removeEventListener(settingsChangedEvent, loadSettings)
    }
  }, [])

  useEffect(() => {
    if (config.mock.dashboard) {
      setTopbarDate(todayLabel)
      return
    }
    setTopbarDate('')
    if (config.mock.auth || !role) return

    let active = true
    async function loadServerDate() {
      try {
        let label = ''
        if (role === 'admin') {
          const dashboard = await getAdminDashboard()
          label = formatTanggal(dashboard.tanggal)
        } else if (role === 'karyawan') {
          const dashboard = await getEmployeeDashboard()
          label = serverDateFormat.format(new Date(dashboard.server_time))
        }
        if (active) setTopbarDate(label)
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : 'Tanggal server gagal dimuat.')
      }
    }
    void loadServerDate()
    return () => {
      active = false
    }
  }, [role])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  function handleLogout() {
    if (!config.mock.auth) {
      void logoutService().catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : 'Keluar dari akun gagal.')
      })
    }
    localStorage.removeItem(ROLE_STORAGE_KEY)
    window.dispatchEvent(new Event(roleChangedEvent))
    router.push('/login')
  }

  if (!hydrated || (!config.mock.auth && auth.loading) || !role || !canAccess) {
    return <PageLoadingSkeleton label={!hydrated || !role ? 'sesi' : 'hak akses'} />
  }

  const account = settings?.users.find((user) => user.role === role)
  const accountName = account?.name ?? (
    role === 'admin' ? adminUser.name
      : role === 'karyawan' ? employeeUser.name
        : role === 'keuangan' ? 'Andi Wijaya' : 'Pemilik'
  )
  const user = config.mock.auth
    ? {
        name: accountName,
        role: role === 'admin' ? 'Admin HRD'
          : role === 'karyawan' ? 'Staf Keuangan'
            : role === 'keuangan' ? 'Tim Keuangan' : 'Akses pemilik',
        initials: accountName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      }
    : {
        name: auth.user?.nama ?? accountName,
        role: auth.user?.jabatan ?? accountName,
        initials: auth.user?.inisial ?? accountName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      }
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
  const expandedNow = mode === 'expanded' || (mode === 'auto' && isWide)
  const widthClass =
    mode === 'collapsed' ? 'md:w-24' : mode === 'expanded' ? 'md:w-72' : 'md:w-24 lg:w-72'

  function handleToggle() {
    setMode(expandedNow ? 'collapsed' : 'expanded')
  }

  return (
    <div className="min-h-dvh bg-surface">
      <div className="flex">
        <div className={`sticky top-0 hidden h-dvh shrink-0 p-4 pr-0 transition-[width] duration-200 md:block ${widthClass}`}>
          <Sidebar
            role={role}
            activeHref={pathname}
            mode={mode}
            expanded={expandedNow}
            onLogout={handleLogout}
            onToggle={handleToggle}
            brandName={settings?.company.name}
            companyLogo={settings?.company.logoDataUrl}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-border bg-surface px-4 py-4 sm:px-6 lg:px-8">
            <Topbar
              title={title}
              subtitle={topbarDate || undefined}
              user={user}
              role={role}
              employeeId={role === 'karyawan' ? 'HP-0001' : undefined}
              companyName={settings?.company.name}
              onMenu={() => setDrawerOpen(true)}
              menuButtonRef={menuButtonRef}
              onLogout={handleLogout}
            />
          </div>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-navy/60 animate-in fade-in duration-200"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative h-full w-[calc(100%-5rem)] max-w-80 p-3 animate-in slide-in-from-left duration-200">
            <Sidebar
              role={role}
              activeHref={pathname}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={handleLogout}
              brandName={settings?.company.name}
              companyLogo={settings?.company.logoDataUrl}
            />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Tutup menu"
              autoFocus
              className="absolute top-5 -right-14 flex size-11 items-center justify-center rounded-full bg-white text-navy shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
