import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/hadirpay/logo'

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="hidden w-[46%] flex-col justify-between gap-12 bg-navy-2 p-10 text-white lg:flex xl:p-14">
        <Link href="/" className="relative w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-white">
          <Logo tone="light" />
          <span className="sr-only">Ke beranda HADIRPAY</span>
        </Link>

        <div className="relative flex flex-col gap-8">
          <p className="max-w-md text-3xl leading-tight font-bold text-balance text-white xl:text-4xl">
            Dari absen pagi sampai jurnal tutup buku, semua tercatat otomatis.
          </p>

        </div>

        <p className="relative text-sm text-blue-200">© 2026 HADIRPAY · Sistem Informasi Akuntansi</p>
      </aside>

      <main className="flex flex-1 flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:hidden">
            <Logo />
            <span className="sr-only">Ke beranda HADIRPAY</span>
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground transition-colors duration-150 hover:bg-surface hover:text-heading"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Kembali ke beranda
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="text-base text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
