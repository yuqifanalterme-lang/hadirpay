import Link from 'next/link'
import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Logo, LogoMark } from '@/components/hadirpay/logo'
import { navGroupsByRole, type Role } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export type CollapseMode = 'auto' | 'expanded' | 'collapsed'

export function Sidebar({
  role,
  activeHref,
  mode = 'expanded',
  size = 'md',
  expanded,
  onNavigate,
  onLogout,
  onToggle,
  className,
  brandName,
  companyLogo,
}: {
  role: Role
  activeHref: string
  mode?: CollapseMode
  size?: 'sm' | 'md'
  expanded?: boolean
  onNavigate?: () => void
  onLogout?: () => void
  onToggle?: () => void
  className?: string
  brandName?: string
  companyLogo?: string
}) {
  const sm = size === 'sm'
  const labelClass =
    sm || mode === 'collapsed' ? 'sr-only' : mode === 'auto' ? 'sr-only lg:not-sr-only' : undefined
  const showWhenExpanded =
    mode === 'collapsed' ? 'hidden' : mode === 'auto' ? 'hidden lg:flex' : 'flex'
  const showWhenCollapsed =
    mode === 'collapsed' ? 'flex' : mode === 'auto' ? 'flex lg:hidden' : 'hidden'
  const rowAlign = sm || mode === 'collapsed' ? 'justify-center' : mode === 'auto' ? 'justify-center lg:justify-start' : ''

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-navy-2 text-white',
        sm ? 'rounded-xl p-1.5' : 'rounded-xl p-4',
        className,
      )}
    >
      <div className={sm ? 'mb-2' : 'mb-6'}>
        <div className={cn('items-center rounded-2xl bg-white', showWhenExpanded, sm ? 'p-1' : 'px-3 py-2.5')}>
          <Logo brandName={brandName} imageUrl={companyLogo} />
        </div>
        <div
          className={cn(
            'items-center justify-center rounded-2xl bg-white',
            showWhenCollapsed,
            sm ? 'rounded-lg p-1' : 'p-2',
          )}
        >
          {companyLogo
            ? <img src={companyLogo} alt="" className={cn('shrink-0 rounded-lg object-contain', sm ? 'size-4' : 'size-8')} />
            : <LogoMark className={sm ? 'size-4' : 'size-8'} />}
          <span className="sr-only">HADIRPAY</span>
        </div>
      </div>

      <nav aria-label="Menu utama" className="-mx-1 flex-1 overflow-y-auto px-1">
        {navGroupsByRole[role].map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && (sm ? 'mt-1.5' : 'mt-5'))}>
            {!sm && (
              <p className={cn('mb-1.5 px-3 text-xs font-medium text-blue-200/80', labelClass)}>{group.label}</p>
            )}
            <ul className={cn('flex flex-col', sm ? 'gap-1' : 'gap-0.5')}>
              {group.items.map((item) => {
                const active =
                  item.href === activeHref ||
                  (item.href !== '/app' && activeHref.startsWith(`${item.href}/`))
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      tabIndex={sm ? -1 : undefined}
                      aria-current={active ? 'page' : undefined}
                      title={mode !== 'expanded' ? item.label : undefined}
                      className={cn(
                        'flex items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                        sm ? 'p-1' : 'min-h-11 gap-3 px-3 text-[15px]',
                        rowAlign,
                        active
                          ? 'bg-white font-semibold text-navy'
                          : 'font-medium text-blue-100 hover:bg-white/10 hover:text-white active:bg-white/15',
                      )}
                    >
                      <Icon
                        className={cn('shrink-0', sm ? 'size-2.5' : 'size-5', active && 'text-primary')}
                        aria-hidden="true"
                      />
                      <span className={cn('flex-1 truncate', labelClass)}>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('flex flex-col', sm ? 'gap-1' : 'mt-4 gap-0.5 border-t border-white/10 pt-3')}>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className={cn(
              'hidden min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium text-blue-100 transition-colors duration-150 hover:bg-white/10 hover:text-white md:flex',
              rowAlign,
            )}
          >
            {expanded ? (
              <PanelLeftClose className="size-5" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            )}
            <span className={labelClass}>{expanded ? 'Ciutkan menu' : 'Perluas menu'}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          tabIndex={sm ? -1 : undefined}
          title={mode !== 'expanded' ? 'Keluar' : undefined}
          className={cn(
            'flex items-center rounded-full font-medium text-blue-100 transition-colors duration-150 hover:bg-white/10 hover:text-white',
            sm ? 'p-1' : 'min-h-11 gap-3 px-3 text-[15px]',
            rowAlign,
          )}
        >
          <LogOut className={sm ? 'size-2.5' : 'size-5'} aria-hidden="true" />
          <span className={labelClass}>Keluar</span>
        </button>
      </div>
    </aside>
  )
}
