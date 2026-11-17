import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn('size-9 shrink-0', className)}>
      <circle cx="25" cy="22" r="13" fill="#10B981" opacity="0.9" />
      <circle cx="17" cy="18" r="14" fill="#2563EB" />
      <circle cx="17" cy="18" r="10.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M11.5 18.5l4 4 7.5-8"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({
  className,
  tone = 'dark',
  showWordmark = true,
}: {
  className?: string
  tone?: 'dark' | 'light'
  showWordmark?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark && (
        <span
          className={cn(
            'text-lg font-extrabold tracking-tight',
            tone === 'light' ? 'text-white' : 'text-heading',
          )}
        >
          HADIR<span className={tone === 'light' ? 'text-blue-300' : 'text-primary'}>PAY</span>
        </span>
      )}
    </span>
  )
}
