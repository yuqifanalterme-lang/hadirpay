import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BrowserFrame({
  url = 'app.hadirpay.id',
  children,
  className,
  compact = false,
}: {
  url?: string
  children: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-white shadow-sm',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 border-b border-border bg-slate-50',
          compact ? 'px-3 py-2' : 'px-4 py-3',
        )}
      >
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
          <span className="size-2.5 rounded-full bg-slate-300" />
        </div>
        <div
          className={cn(
            'mx-auto flex items-center gap-1.5 rounded-md border border-border bg-white text-muted-foreground',
            compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
          )}
        >
          <Lock className="size-3" aria-hidden="true" />
          {url}
        </div>
        <span className="w-10" aria-hidden="true" />
      </div>
      {children}
    </div>
  )
}
