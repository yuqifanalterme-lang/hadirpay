'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Bell, LogOut, Menu, Shield, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import type { Role } from '@/lib/navigation'
import {
  listNotifications,
  markNotificationRead,
  markNotificationsRead,
  notificationsChangedEvent,
  type AppNotification,
} from '@/lib/services/notification-service'
import { updateDemoPassword } from '@/lib/services/auth-service'
import { requestsChangedEvent } from '@/lib/services/request-events'
import { cn } from '@/lib/utils'

export function Topbar({
  title,
  subtitle,
  user,
  role = 'admin',
  employeeId,
  companyName = 'HADIRPAY',
  size = 'md',
  onMenu,
  menuButtonRef,
  onLogout,
}: {
  title: string
  subtitle?: string
  user: { name: string; role: string; initials: string }
  role?: Role
  employeeId?: string
  companyName?: string
  size?: 'sm' | 'md'
  onMenu?: () => void
  menuButtonRef?: React.Ref<HTMLButtonElement>
  onLogout?: () => void
}) {
  const router = useRouter()
  const sm = size === 'sm'
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [notificationError, setNotificationError] = useState('')
  const [notificationLoading, setNotificationLoading] = useState(true)
  const [openPanel, setOpenPanel] = useState<'notifications' | 'profile' | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  async function loadNotifications() {
    setNotificationLoading(true)
    setNotificationError('')
    try {
      setNotifications(await listNotifications(role, employeeId))
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Notifikasi gagal dimuat.')
    } finally {
      setNotificationLoading(false)
    }
  }

  useEffect(() => {
    if (sm) return
    void loadNotifications()
    const refresh = () => void loadNotifications()
    window.addEventListener('storage', refresh)
    window.addEventListener(requestsChangedEvent, refresh)
    window.addEventListener(notificationsChangedEvent, refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(requestsChangedEvent, refresh)
      window.removeEventListener(notificationsChangedEvent, refresh)
    }
  }, [role, employeeId, sm])

  useEffect(() => {
    if (!openPanel) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenPanel(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openPanel])

  const unreadCount = notifications.filter((item) => !item.isRead).length
  const bellInner = (
    <>
      <Bell className={sm ? 'size-2.5' : 'size-5'} aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-white font-bold text-primary ring-2 ring-primary',
            sm ? '-top-0.5 -right-0.5 size-2 text-[0px]' : '-top-1 -right-1 size-5 text-[11px]',
          )}
          aria-hidden="true"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </>
  )
  const bellClass = cn(
    'relative flex items-center justify-center rounded-full bg-primary text-white transition-colors duration-150 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    sm ? 'size-5' : 'size-11',
  )

  function showProfile() {
    setOpenPanel(null)
    setProfileOpen(true)
  }

  function showPasswordForm() {
    setOpenPanel(null)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordOpen(true)
  }

  function handleLogout() {
    if (onLogout) {
      onLogout()
      return
    }
    localStorage.removeItem('hadirpay-role')
    router.push('/login')
  }

  function handleNotificationClick(notification: AppNotification) {
    try {
      markNotificationRead(notification.id)
      setNotifications((current) => current.map((item) =>
        item.id === notification.id ? { ...item, isRead: true } : item,
      ))
      setOpenPanel(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Notifikasi gagal diperbarui.')
    }
  }

  function markAllRead() {
    try {
      markNotificationsRead(notifications)
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Notifikasi gagal diperbarui.')
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi baru belum sama.')
      return
    }
    setPasswordSaving(true)
    try {
      await updateDemoPassword(role, currentPassword, newPassword)
      toast.success('Kata sandi role demo berhasil diperbarui.')
      setPasswordOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kata sandi gagal diperbarui.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <>
      <header className={cn('flex items-center justify-between', sm ? 'gap-2' : 'gap-3')}>
        <div className="flex min-w-0 items-center gap-3">
          {onMenu && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={onMenu}
              aria-label="Buka menu"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-heading focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className={cn('truncate font-extrabold tracking-tight text-heading', sm ? 'text-[11px]' : 'text-xl sm:text-2xl')}>
              {title}
            </h1>
            {subtitle && !sm && <p className="hidden truncate text-sm text-muted-foreground sm:block">{subtitle}</p>}
            {!sm && <p className="text-[10px] font-medium text-muted-foreground lg:hidden">Data contoh</p>}
          </div>
        </div>

        <div ref={rootRef} className={cn('relative flex shrink-0 items-center', sm ? 'gap-1' : 'gap-2 sm:gap-3')}>
          {!sm && (
            <span className="hidden rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground lg:inline">
              Mode demo · data contoh
            </span>
          )}
          {sm ? (
            <span className={bellClass} aria-hidden="true">{bellInner}</span>
          ) : (
            <button
              type="button"
              className={bellClass}
              onClick={() => setOpenPanel((current) => current === 'notifications' ? null : 'notifications')}
              aria-label={`Notifikasi, ${unreadCount} belum dibaca`}
              aria-expanded={openPanel === 'notifications'}
              aria-controls="topbar-notifications"
            >
              {bellInner}
            </button>
          )}
          {sm ? (
            <div className="flex items-center rounded-full border border-border bg-white py-0.5 pr-1.5 pl-0.5">
              <Avatar initials={user.initials} size="xs" tone="navy" />
              <span className="ml-1 leading-tight">
                <span className="block text-[7px] font-semibold text-heading">{user.name}</span>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpenPanel((current) => current === 'profile' ? null : 'profile')}
              className="flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-white py-1 pr-3 pl-1 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:pr-4"
              aria-haspopup="true"
              aria-expanded={openPanel === 'profile'}
              aria-label={`Profil ${user.name}`}
            >
              <Avatar initials={user.initials} size="md" tone="navy" />
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold text-heading">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{user.role}</span>
              </span>
              <span className="sr-only sm:hidden">{`${user.name}, ${user.role}`}</span>
            </button>
          )}

          {!sm && openPanel === 'notifications' && (
            <section
              id="topbar-notifications"
              aria-label="Notifikasi"
              className="absolute top-14 right-0 z-30 flex max-h-[min(70dvh,32rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-2xl border border-border bg-white p-4 shadow-lg"
            >
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="font-bold text-heading">Notifikasi</h2>
                {unreadCount > 0 && (
                  <Button type="button" variant="outline" size="sm" onClick={markAllRead}>
                    Tandai dibaca
                  </Button>
                )}
              </div>
              {notificationLoading ? (
                <p className="py-5 text-sm text-muted-foreground" role="status">Memuat notifikasi…</p>
              ) : notificationError ? (
                <div className="flex flex-col gap-3 py-4" role="alert">
                  <p className="text-sm text-destructive">{notificationError}</p>
                  <Button type="button" variant="outline" size="action" onClick={() => void loadNotifications()}>Coba lagi</Button>
                </div>
              ) : notifications.length ? (
                <ul className="divide-y divide-border">
                  {notifications.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={() => handleNotificationClick(item)}
                        className="flex min-h-16 gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <span className={cn('mt-1 size-2 shrink-0 rounded-full', item.isRead ? 'bg-slate-300' : 'bg-primary')} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block text-sm text-heading', item.isRead ? 'font-medium' : 'font-bold')}>{item.title}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                        </span>
                        <span className="sr-only">{item.isRead ? 'Sudah dibaca' : 'Belum dibaca'}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">Belum ada notifikasi untuk akun ini.</p>
              )}
            </section>
          )}

          {!sm && openPanel === 'profile' && (
            <div className="absolute top-14 right-0 z-30 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-2 shadow-lg">
              <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                <Avatar initials={user.initials} size="md" tone="navy" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-heading">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.role} · {companyName}</p>
                </div>
              </div>
              <button type="button" onClick={showProfile} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-heading hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                Profil saya
              </button>
              <button type="button" onClick={showPasswordForm} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-heading hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                <Shield className="size-4 text-muted-foreground" aria-hidden="true" />
                Ubah password
              </button>
              <button type="button" onClick={() => { setOpenPanel(null); router.push('/login') }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-heading hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
                <UserRound className="size-4 text-muted-foreground" aria-hidden="true" />
                Ganti role demo
              </button>
              <button type="button" onClick={handleLogout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-destructive hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-destructive">
                <LogOut className="size-4" aria-hidden="true" />
                Keluar
              </button>
            </div>
          )}
        </div>
      </header>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen} label="Profil saya">
        <DialogHeader title="Profil saya" description="Identitas pengguna pada sesi demo HADIRPAY." onClose={() => setProfileOpen(false)} />
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar initials={user.initials} size="lg" tone="navy" />
            <div>
              <p className="font-bold text-heading">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.role}</p>
            </div>
          </div>
          <dl className="grid gap-3 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Perusahaan</dt><dd className="font-semibold text-heading">{companyName}</dd></div>
            <div><dt className="text-muted-foreground">Mode akses</dt><dd className="font-semibold text-heading">Demo</dd></div>
          </dl>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" size="action" onClick={() => setProfileOpen(false)}>Tutup</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen} label="Ubah password">
        <DialogHeader title="Ubah password" description="Kata sandi demo disimpan sebagai hash di browser ini." onClose={() => setPasswordOpen(false)} />
        <form onSubmit={submitPassword} className="flex flex-col gap-4 p-5 sm:p-6">
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Password saat ini
            <input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Password baru
            <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-semibold text-heading">
            Konfirmasi password baru
            <input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" />
          </label>
          <p className="text-xs text-muted-foreground">Password awal mode demo adalah demo12345. Perubahan berlaku untuk role demo ini.</p>
          <DialogFooter>
            <Button type="button" variant="outline" size="action" onClick={() => setPasswordOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" size="action" disabled={passwordSaving}>
              {passwordSaving ? 'Menyimpan…' : 'Simpan password'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
