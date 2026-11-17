import { cn } from '@/lib/utils'

const sizes = {
  xs: 'size-4 text-[6px]',
  md: 'size-9 text-xs',
  lg: 'size-10 text-sm',
}

const tones = {
  navy: 'bg-navy-2 text-white',
  muted: 'bg-slate-100 text-heading',
  outlined: 'bg-white text-heading ring-1 ring-border',
}

export function Avatar({
  initials,
  size = 'md',
  tone = 'muted',
  className,
}: {
  initials: string
  size?: keyof typeof sizes
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        sizes[size],
        tones[tone],
        className,
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
