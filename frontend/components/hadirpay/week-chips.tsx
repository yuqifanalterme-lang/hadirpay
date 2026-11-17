import { Check, Clock } from 'lucide-react'
import type { WeekDay } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export function WeekChips({ days, size = 'md' }: { days: WeekDay[]; size?: 'sm' | 'md' }) {
  const sm = size === 'sm'
  return (
    <ol className={cn('grid grid-cols-5', sm ? 'gap-1' : 'gap-2 sm:gap-3')}>
      {days.map((d) => (
        <li
          key={d.short}
          className={cn(
            'flex flex-col items-center rounded-2xl border bg-white text-center',
            d.state === 'today' ? 'border-primary ring-2 ring-primary/15' : 'border-border',
            sm ? 'gap-0.5 rounded-lg p-1' : 'gap-1.5 px-1 py-3',
          )}
        >
          <span
            className={cn(
              'flex items-center justify-center rounded-full',
              sm ? 'size-3.5' : 'size-8',
              d.state === 'done' && 'bg-success text-white',
              d.state === 'today' && 'bg-primary text-white',
              d.state === 'upcoming' && 'bg-slate-100 text-slate-400',
            )}
          >
            {d.state === 'done' ? (
              <Check className={sm ? 'size-2' : 'size-4'} strokeWidth={3} aria-hidden="true" />
            ) : d.state === 'today' ? (
              <Clock className={sm ? 'size-2' : 'size-4'} aria-hidden="true" />
            ) : (
              <span className={cn('rounded-full bg-slate-300', sm ? 'size-1' : 'size-1.5')} />
            )}
          </span>
          <span className={cn('whitespace-nowrap text-muted-foreground', sm ? 'text-[6px]' : 'text-[11px]')}>{d.date}</span>
          <span className={cn('font-bold text-heading', sm ? 'text-[8px]' : 'text-sm')}>{d.short}</span>
          {d.note && !sm && <span className="text-[11px] font-medium text-muted-foreground">{d.note}</span>}
          <span className="sr-only">
            {d.state === 'done' ? 'selesai' : d.state === 'today' ? 'hari ini' : 'belum berlangsung'}
          </span>
        </li>
      ))}
    </ol>
  )
}
