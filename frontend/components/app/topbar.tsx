import Link from 'next/link'
import { Bell, Menu } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function Topbar({
  title,
  subtitle,
  user,
  size = 'md',
  notificationHref,
  notificationCount = 0,
  notificationLabel,
  onMenu,
  menuButtonRef,
}: {
  title: string
  subtitle?: string
  user: { name: string; role: string; initials: string }
  size?: 'sm' | 'md'
  notificationHref?: string
  notificationCount?: number
  notificationLabel?: string
  onMenu?: () => void
  menuButtonRef?: React.Ref<HTMLButtonElement>
}) {
  const sm = size === 'sm'
  const bellInner = (
    <>
      <Bell className={sm ? 'size-2.5' : 'size-5'} aria-hidden="true" />
      {notificationCount > 0 && (
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-white font-bold text-primary ring-2 ring-primary',
            sm ? '-top-0.5 -right-0.5 size-2 text-[0px]' : '-top-1 -right-1 size-5 text-[11px]',
          )}
        >
          {notificationCount}
        </span>
      )}
    </>
  )
  const bellClass = cn(
    'relative flex items-center justify-center rounded-full bg-primary text-white transition-colors duration-150 hover:bg-blue-700',
    sm ? 'size-5' : 'size-11',
  )

  return (
    <header className={cn('flex items-center justify-between', sm ? 'gap-2' : 'gap-3')}>
      <div className="flex min-w-0 items-center gap-3">
        {onMenu && (
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onMenu}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-heading md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="sr-only">Buka menu</span>
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

      <div className={cn('flex shrink-0 items-center', sm ? 'gap-1' : 'gap-2 sm:gap-3')}>
        {!sm && (
          <span className="hidden rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground lg:inline">
            Mode demo · data contoh
          </span>
        )}
        {notificationHref ? (
          <Link href={notificationHref} className={bellClass}>
            {bellInner}
            <span className="sr-only">{notificationLabel ?? `${notificationCount} pengajuan perlu ditinjau`}</span>
          </Link>
        ) : (
          <span className={bellClass} aria-hidden="true">
            {bellInner}
          </span>
        )}
        <div
          className={cn(
            'flex items-center rounded-full border border-border bg-white',
            sm ? 'gap-1 py-0.5 pr-1.5 pl-0.5' : 'min-h-11 gap-2.5 py-1 pr-4 pl-1',
          )}
        >
          <Avatar initials={user.initials} size={sm ? 'xs' : 'md'} tone="navy" />
          <span className={cn('text-left leading-tight', !sm && 'hidden sm:block')}>
            <span className={cn('block font-semibold text-heading', sm ? 'text-[7px]' : 'text-sm')}>{user.name}</span>
            {!sm && <span className="block text-xs text-muted-foreground">{user.role}</span>}
          </span>
          {!sm && <span className="sr-only sm:hidden">{`${user.name}, ${user.role}`}</span>}
        </div>
      </div>
    </header>
  )
}
