import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatIconTone =
  | 'primary'
  | 'blue'
  | 'green'
  | 'success'
  | 'amber'
  | 'orange'
  | 'warning'
  | 'red'
  | 'destructive'
  | 'danger'
  | 'sky'
  | 'info'
  | 'violet'
  | 'purple'
  | 'leave'
  | 'white'
  | 'muted'
  | 'slate'
  | 'navy'

export type StatIconSize = 'sm' | 'md' | 'lg'

const toneStyles: Record<StatIconTone, string> = {
  primary: 'text-primary',
  blue: 'text-primary',
  green: 'text-success',
  success: 'text-success',
  amber: 'text-amber-700',
  orange: 'text-amber-700',
  warning: 'text-amber-700',
  red: 'text-red-600',
  destructive: 'text-red-600',
  danger: 'text-red-600',
  sky: 'text-sky-700',
  info: 'text-sky-700',
  violet: 'text-violet-700',
  purple: 'text-violet-700',
  leave: 'text-violet-700',
  white: 'text-white',
  muted: 'text-muted-foreground',
  slate: 'text-slate-600',
  navy: 'text-white',
}

const sizeStyles: Record<StatIconSize, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-7 sm:size-8',
}

export function StatIcon({
  icon: Icon,
  tone = 'primary',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone?: StatIconTone
  size?: StatIconSize
  className?: string
}) {
  return (
    <Icon
      className={cn('shrink-0', sizeStyles[size], toneStyles[tone], className)}
      aria-hidden="true"
    />
  )
}
