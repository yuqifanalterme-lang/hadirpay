import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function StatusPage({
  code,
  title,
  description,
  homeHref = '/app',
  homeLabel = 'Kembali ke dashboard',
}: {
  code: '403' | '404'
  title: string
  description: string
  homeHref?: string
  homeLabel?: string
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10 sm:px-6">
      <section className="flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border border-border bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-primary" aria-hidden="true">
          <ShieldAlert className="size-7" />
        </span>
        <p className="text-sm font-bold text-primary">HADIRPAY · {code}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">{title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={homeHref} className={buttonVariants({ variant: 'primary', size: 'action' })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {homeLabel}
          </Link>
          {code === '403' && (
            <Link href="/login" className={buttonVariants({ variant: 'outline', size: 'action' })}>
              Ganti akun demo
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
