import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function CtaBanner() {
  return (
    <section className="bg-surface px-5 pb-20 sm:px-8 sm:pb-24">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 rounded-xl bg-navy-2 px-6 py-12 sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="relative max-w-xl text-2xl leading-snug font-extrabold text-balance text-white sm:text-3xl">
          Siap mengelola administrasi penggajian dan akuntansi lebih efisien?
        </h2>
        <div className="relative flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/login"
            className={buttonVariants({
              variant: 'primary',
              size: 'cta',
              className: 'shadow-lg shadow-blue-600/40 transition-colors duration-200 hover:bg-blue-500',
            })}
          >
            Login Sekarang
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
          <Link
            href="/register"
            className={buttonVariants({
              variant: 'inverseOutline',
              size: 'cta',
              className: 'justify-center transition-colors duration-200',
            })}
          >
            Daftar Akun Baru
          </Link>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  return (
    <footer className="bg-navy">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-blue-200 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© 2026 HADIRPAY</p>
        <p>Sistem Informasi Akuntansi · Proyek Pengembangan Sistem</p>
      </div>
    </footer>
  )
}
