import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function CtaBanner() {
  return (
    <section className="relative isolate overflow-hidden bg-navy-2 pt-36 pb-16 sm:pt-44 sm:pb-20 lg:pt-48 lg:pb-24">
      {/* ── Top wave transitioning from bg-white into bg-navy-2 ── */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-1px] z-0 block h-20 w-full sm:h-28 lg:h-32"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0 0 L1440 0 L1440 82 C1180 30 980 24 720 74 C460 124 260 112 0 56 Z"
          fill="var(--background)"
        />
      </svg>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="max-w-xl text-2xl leading-snug font-extrabold text-balance text-white sm:text-3xl">
          Siap mengelola administrasi penggajian dan akuntansi lebih efisien?
        </h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/login"
            className={buttonVariants({
              variant: 'primary',
              size: 'cta',
              className: 'w-full justify-center shadow-lg shadow-blue-600/40 transition-colors duration-200 hover:bg-blue-500 sm:w-auto',
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
              className: 'w-full justify-center transition-colors duration-200 sm:w-auto',
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
    <footer className="bg-navy-2 -mt-px pt-px">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-10">
        <p>© 2026 HADIRPAY</p>
        <p className="text-blue-100">Sistem Informasi Akuntansi · Proyek Pengembangan Sistem</p>
      </div>
    </footer>
  )
}
