import type { LucideIcon } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string
  description: string
  icon: LucideIcon
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-4 py-10 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-semibold text-heading">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface px-4 py-10 text-center" role="alert">
      <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
      <p className="font-semibold text-heading">Data tidak dapat dimuat</p>
      <p className="max-w-xl text-sm text-muted-foreground">{message}</p>
      <Button
        type="button"
        variant="outline"
        size="action"
        className="bg-white"
        onClick={onRetry}
      >
        Coba lagi
      </Button>
    </div>
  )
}
