import type { LucideIcon } from 'lucide-react'
import { StatIcon, type StatIconTone } from '@/components/ui/stat-icon'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
  size = 'md',
  highlight = false,
  className,
}: {
  label: string
  value: string
  hint?: string
  icon: LucideIcon
  tone?: StatIconTone
  size?: 'sm' | 'md'
  highlight?: boolean
  className?: string
}) {
  const sm = size === 'sm'
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border transition-shadow duration-200',
        highlight
          ? 'border-transparent bg-navy-2 text-white'
          : 'border-border bg-card shadow-sm hover:shadow-md',
        sm ? 'gap-1.5 p-2.5' : 'gap-3 p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'font-medium',
            highlight ? 'text-blue-100' : 'text-muted-foreground',
            sm ? 'text-[9px] leading-tight' : 'text-sm',
          )}
        >
          {label}
        </span>
        <StatIcon
          icon={Icon}
          tone={highlight ? 'white' : tone}
          size={sm ? 'sm' : 'md'}
        />
      </div>
      <p
        className={cn(
          'font-bold tracking-tight',
          highlight ? 'text-white' : 'text-heading',
          sm ? 'text-xs' : highlight ? 'text-2xl 2xl:text-xl min-[1700px]:text-2xl' : 'text-2xl',
        )}
      >
        {value}
      </p>
      {hint && !sm && (
        <p className={cn('text-xs', highlight ? 'text-blue-100' : 'text-muted-foreground')}>{hint}</p>
      )}
    </div>
  )
}
