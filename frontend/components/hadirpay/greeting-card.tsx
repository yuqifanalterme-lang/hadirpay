import { cn } from '@/lib/utils'

export function GreetingCard({
  greeting,
  message,
  children,
  className,
}: {
  greeting: string
  message: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-white p-6 sm:p-7',
        className,
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">{greeting}</h2>
          <p className="max-w-xl text-base leading-relaxed text-pretty text-foreground">{message}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
