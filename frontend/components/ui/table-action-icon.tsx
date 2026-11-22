'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

type TableActionIconProps = {
  label: string
  ariaLabel: string
  icon: LucideIcon
  tone: 'blue' | 'red' | 'green'
  onClick?: () => void
  href?: string
  disabled?: boolean
}

const toneClasses = {
  blue: 'text-slate-500 hover:text-[#2563EB] focus-visible:text-[#2563EB] hover:[background-color:rgba(37,99,235,0.08)]',
  red: 'text-slate-500 hover:text-[#EF4444] focus-visible:text-[#EF4444] hover:[background-color:rgba(239,68,68,0.08)]',
  green: 'text-slate-500 hover:text-[#10B981] focus-visible:text-[#10B981] hover:[background-color:rgba(16,185,129,0.08)]',
}

export function TableActionIcon({
  label,
  ariaLabel,
  icon: Icon,
  tone,
  onClick,
  href,
  disabled,
}: TableActionIconProps) {
  const className = cn(
    'inline-flex size-10 items-center justify-center rounded-full bg-transparent text-slate-500',
    'transition-[color,background-color] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-50',
    toneClasses[tone],
  )

  const control = href ? (
    <a href={href} className={className} aria-label={ariaLabel}>
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </a>
  ) : (
    <button type="button" className={className} aria-label={ariaLabel} onClick={onClick} disabled={disabled}>
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  )

  return <Tooltip content={label}>{control}</Tooltip>
}
