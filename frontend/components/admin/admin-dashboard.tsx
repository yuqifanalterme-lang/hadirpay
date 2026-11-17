import Link from 'next/link'
import { ArrowRight, CircleAlert, Clock, UserCheck, Users, Wallet } from 'lucide-react'
import { ApprovalsList } from './approvals-list'
import { AttendanceChart } from '@/components/hadirpay/attendance-chart'
import { AttendanceTable } from '@/components/hadirpay/attendance-table'
import { GreetingCard } from '@/components/hadirpay/greeting-card'
import { Panel } from '@/components/hadirpay/panel'
import { StatCard } from '@/components/hadirpay/stat-card'
import { WeekChips } from '@/components/hadirpay/week-chips'
import { buttonVariants } from '@/components/ui/button'
import { adminStats, adminWeek, formatRupiah, recentAttendance } from '@/lib/mock-data'

export function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <GreetingCard
          className="lg:col-span-2"
          greeting="Selamat pagi, Rina!"
          message={
            <>
              Rekap absensi hari ini sudah <strong className="text-heading">85% terisi</strong>. Ada{' '}
              <strong className="text-heading">pengajuan</strong> yang menunggu persetujuan dan periode gaji
              November ditutup pada 25 Nov 2026.
            </>
          }
        >
          <div className="mt-auto flex flex-wrap gap-3">
            <Link
              href="/app/absensi"
              className={buttonVariants({
                variant: 'primary',
                size: 'action',
                className: 'gap-2 transition-colors duration-150',
              })}
            >
              Lihat rekap absensi
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/app/penggajian"
              className={buttonVariants({
                variant: 'outline',
                size: 'action',
                className: 'gap-2 bg-white transition-colors duration-150',
              })}
            >
              Proses penggajian
            </Link>
          </div>
        </GreetingCard>

        <Panel title="Kehadiran minggu ini" description="Persentase karyawan hadir per hari">
          <WeekChips days={adminWeek} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Rata-rata minggu lalu 92% hadir
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Karyawan" value={String(adminStats.totalKaryawan)} hint="Aktif per 17 Nov 2026" icon={Users} tone="blue" />
        <StatCard label="Hadir Hari Ini" value={String(adminStats.hadir)} hint="85% dari total karyawan" icon={UserCheck} tone="green" />
        <StatCard label="Terlambat" value={String(adminStats.terlambat)} hint="Lewat dari pukul 08.00" icon={Clock} tone="amber" />
        <StatCard label="Tidak Hadir" value={String(adminStats.tidakHadir)} hint="1 izin, 1 cuti, 1 alpha" icon={CircleAlert} tone="red" />
        <StatCard
          className="col-span-2 2xl:col-span-1"
          label="Total Gaji Bulan Berjalan"
          value={formatRupiah(adminStats.totalGaji)}
          hint="Estimasi periode November 2026"
          icon={Wallet}
          highlight
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Tren kehadiran"
          description="7 hari kerja terakhir"
          action={
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
                Hadir
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-success" aria-hidden="true" />
                Tepat waktu
              </span>
            </div>
          }
        >
          <div className="h-72 lg:h-auto lg:min-h-72 lg:flex-1">
            <AttendanceChart height="100%" />
          </div>
        </Panel>

        <Panel title="Pengajuan menunggu persetujuan" description="Cuti, izin, sakit, koreksi absensi, dan lembur">
          <ApprovalsList />
        </Panel>
      </div>

      <Panel
        title="Absensi terbaru"
        description="Check-in hari ini, Selasa 17 Nov 2026"
        action={
          <Link href="/app/absensi" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Lihat semua
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        <AttendanceTable rows={recentAttendance} caption="Daftar absensi terbaru hari ini" />
      </Panel>
    </div>
  )
}
