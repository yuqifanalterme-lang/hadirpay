import Link from 'next/link'
import { AdminMockup } from './admin-mockup'
import { buttonVariants } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="bg-navy-2 pt-32 pb-16 text-white lg:pt-40">
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-7">
          <h1 className="text-4xl leading-[1.1] font-extrabold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.4rem]">
            Kelola Absensi, Penggajian, dan Jurnal Akuntansi dalam Satu Sistem.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-pretty text-blue-100">
            Otomatisasi rekap kehadiran karyawan hingga penerbitan slip gaji dan jurnal akuntansi secara akurat dan
            terintegrasi.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className={buttonVariants({
                variant: 'primary',
                size: 'cta',
                className: 'justify-center transition-colors duration-200 hover:bg-blue-500',
              })}
            >
              Masuk ke Aplikasi
            </Link>
            <Link
              href="/register"
              className={buttonVariants({
                variant: 'inverseOutline',
                size: 'cta',
                className: 'justify-center transition-colors duration-200',
              })}
            >
              Daftar Akun
            </Link>
          </div>
        </div>

        <figure className="mx-auto w-full max-w-xl lg:max-w-none">
          <div inert aria-hidden="true">
            <AdminMockup />
          </div>
          <figcaption className="mt-3 text-center text-sm text-blue-100">Tampilan pratinjau, data contoh.</figcaption>
        </figure>
      </div>
    </section>
  )
}
