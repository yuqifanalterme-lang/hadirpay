import Link from 'next/link'
import { Sidebar } from '@/components/app/sidebar'
import { Topbar } from '@/components/app/topbar'
import { buttonVariants } from '@/components/ui/button'
import { BrowserFrame } from '@/components/hadirpay/browser-frame'
import { StatusBadge } from '@/components/hadirpay/status-badge'
import { WeekChips } from '@/components/hadirpay/week-chips'
import { employeeUser, formatRupiah, payslip, recentAttendance, type WeekDay } from '@/lib/mock-data'
import { AdminMockup } from './admin-mockup'
import { PengajuanMockup } from './pengajuan-mockup'
import { SlipGajiMockup } from './slipgaji-mockup'

const employeeWeek: WeekDay[] = [
  { short: 'SEN', date: '16 Nov', state: 'done' },
  { short: 'SEL', date: '17 Nov', state: 'today' },
  { short: 'RAB', date: '18 Nov', state: 'upcoming' },
  { short: 'KAM', date: '19 Nov', state: 'upcoming' },
  { short: 'JUM', date: '20 Nov', state: 'upcoming' },
]

function EmployeeMockup() {
  const attendance = recentAttendance.find((row) => row.name === employeeUser.name)

  return (
    <BrowserFrame compact url="app.hadirpay.id/beranda">
      <div className="flex gap-2 bg-surface p-2 text-left">
        <div className="w-9 shrink-0">
          <Sidebar role="karyawan" activeHref="/app/beranda" mode="collapsed" size="sm" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Topbar title="Beranda" user={employeeUser} size="sm" />
          {/* Absensi hari ini */}
          <div className="rounded-lg border border-border bg-white p-1.5">
            <p className="text-[8px] font-bold text-heading">Absensi hari ini</p>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-xs font-bold text-heading">{attendance?.checkIn ?? '—'}</p>
              {attendance && <StatusBadge status={attendance.status} className="px-1 py-0 text-[6px]" />}
            </div>
          </div>
          {/* Kehadiran minggu ini */}
          <div className="rounded-lg border border-border bg-white p-1.5">
            <p className="mb-1 text-[8px] font-bold text-heading">Minggu ini</p>
            <WeekChips days={employeeWeek} size="sm" />
          </div>
          {/* Slip gaji terakhir */}
          <div className="rounded-lg border border-border bg-white p-1.5">
            <p className="text-[8px] font-bold text-heading">Slip gaji terakhir</p>
            <p className="mt-0.5 text-[10px] font-bold text-heading">{formatRupiah(payslip.net)}</p>
            <p className="text-[6px] text-muted-foreground">{payslip.periode} · Gaji bersih</p>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

/**
 * Wrapper that renders child at full size (520x280), then CSS-scales it down.
 * The outer div has explicit dimensions matching the scaled result (increased by 10%)
 * so surrounding layout sees the correct occupied space.
 */
function ScaledPreview({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={className}
      style={{
        width: 'calc(var(--card-w) * 1.1)',
        height: 'calc(var(--card-w) * 1.1 * (280 / 520))',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none origin-top-left [&>div]:h-full [&>div>div]:h-full [&_.min-\[768px\]\:grid-cols-5]:grid-cols-5 [&_.min-\[640px\]\:grid-cols-5]:grid-cols-5"
        style={{
          width: 'var(--pw)',
          height: 'var(--ph)',
          transform: 'scale(calc((var(--card-w) / 520px) * 1.1))',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-navy-2 text-white [--pw:520px] [--ph:280px] [--card-w:clamp(210px,58vw,240px)] sm:[--card-w:clamp(180px,23.5vw,200px)] lg:[--card-w:clamp(220px,20vw,300px)]">
      {/* ── Main content container (padding-bottom increased by ~90px for extra height & safe clearance) ── */}
      <div className="relative z-20 mx-auto max-w-7xl px-4 pt-28 pb-[220px] sm:px-6 sm:pt-32 sm:pb-[340px] lg:px-8 lg:pt-36 lg:pb-[380px]">
        {/* Central heading, subtitle, buttons */}
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center sm:px-8">
          <h1 className="w-full text-2xl leading-[1.1] font-extrabold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.4rem]">
            Absensi, Gaji, dan Jurnal dalam Satu Sistem.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-pretty text-blue-100">
            Dari rekap kehadiran sampai slip gaji dan jurnal, semua otomatis.
          </p>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/login"
              className={buttonVariants({
                variant: 'primary',
                size: 'cta',
                className: 'w-full justify-center transition-colors duration-200 hover:bg-blue-500 sm:w-auto',
              })}
            >
              Masuk ke Aplikasi
            </Link>
            <Link
              href="/register"
              className={buttonVariants({
                variant: 'inverseOutline',
                size: 'cta',
                className: 'w-full justify-center transition-colors duration-200 sm:w-auto',
              })}
            >
              Daftar Akun
            </Link>
          </div>
        </div>

        {/* ── 4 preview cards: 2 left, 2 right (Desktop & Tablet) ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto hidden h-full max-w-7xl sm:block"
        >
          {/* ── LEFT STACK ── */}
          <div className="absolute left-1.5 sm:left-2 md:left-3 lg:left-6 xl:left-8 top-[260px] sm:top-[275px] lg:top-[295px]">
            {/* Back-left: Pengajuan */}
            <figure
              className="absolute left-0 top-0 z-[1]"
              style={{ transform: 'rotate(-3deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <PengajuanMockup />
                </div>
              </ScaledPreview>
            </figure>
            {/* Front-left: Dashboard */}
            <figure
              className="absolute left-[132px] sm:left-[125px] lg:left-[143px] top-[121px] sm:top-[123px] lg:top-[132px] z-[2]"
              style={{ transform: 'rotate(2deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <AdminMockup />
                </div>
              </ScaledPreview>
            </figure>
          </div>

          {/* ── RIGHT STACK ── */}
          <div className="absolute right-1.5 sm:right-2 md:right-3 lg:right-6 xl:right-8 top-[260px] sm:top-[275px] lg:top-[295px]">
            {/* Back-right: Slip Gaji */}
            <figure
              className="absolute right-0 top-0 z-[1]"
              style={{ transform: 'rotate(3deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <SlipGajiMockup />
                </div>
              </ScaledPreview>
            </figure>
            {/* Front-right: Beranda */}
            <figure
              className="absolute right-[132px] sm:right-[125px] lg:right-[143px] top-[121px] sm:top-[123px] lg:top-[132px] z-[2]"
              style={{ transform: 'rotate(-2deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <EmployeeMockup />
                </div>
              </ScaledPreview>
            </figure>
          </div>
        </div>

        {/* ── Mobile: 2 cards only (dashboard + beranda) stacked below buttons ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none relative mx-auto mt-8 flex justify-center sm:hidden"
        >
          <div
            className="relative"
            style={{
              width: 'calc(var(--card-w) * 1.1 + 24px)',
              height: 'calc(var(--card-w) * 1.1 * (280 / 520) + 28px)',
            }}
          >
            {/* Back mobile card: Admin Dashboard */}
            <figure
              className="absolute left-0 top-0 z-[1]"
              style={{ transform: 'rotate(-2.5deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <AdminMockup />
                </div>
              </ScaledPreview>
            </figure>
            {/* Front mobile card: Beranda Karyawan */}
            <figure
              className="absolute left-6 top-7 z-[2]"
              style={{ transform: 'rotate(2.5deg)' }}
            >
              <ScaledPreview>
                <div inert>
                  <EmployeeMockup />
                </div>
              </ScaledPreview>
            </figure>
          </div>
        </div>
      </div>

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[-1px] z-0 block h-20 w-full sm:h-24 lg:h-28"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
      >
        <path
          d="M0 56 C260 112 460 124 720 74 C980 24 1180 30 1440 82 L1440 120 L0 120 Z"
          fill="var(--background)"
        />
      </svg>
    </section>
  )
}
