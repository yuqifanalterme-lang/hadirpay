'use client'

import { useEffect, useState } from 'react'
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
import { ErrorState } from '@/components/ui/empty-state'
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton'
import { formatRupiah, type AttendanceRow } from '@/lib/mock-data'
import { formatTanggal } from '@/lib/format'
import { useAuth } from '@/lib/auth/auth-provider'
import { config } from '@/lib/config'
import { getAdminDashboard } from '@/lib/services/dashboard.service'
import type { DashboardAdmin } from '@/lib/types/dashboard'

const attendanceStatusLabels: Record<Exclude<DashboardAdmin['absensi_terbaru'][number]['status'], null>, AttendanceRow['status']> = {
  hadir: 'Hadir',
  terlambat: 'Terlambat',
  izin: 'Izin',
  sakit: 'Sakit',
  cuti: 'Cuti',
  alpha: 'Alpha',
  dinas_luar: 'Dinas Luar',
}
type DashboardAttendanceRow = Omit<AttendanceRow, 'status'> & { status: AttendanceRow['status'] | null }

function displayTime(value: string | null) {
  return value ? value.slice(0, 5).replace(':', '.') : '—'
}

export function AdminDashboard() {
  const auth = useAuth()
  const [data, setData] = useState<DashboardAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getAdminDashboard()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Dashboard gagal dimuat.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [retry])

  if (loading) return <PageLoadingSkeleton label="dashboard Admin HRD" />
  if (error) return <ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} />
  if (!data) return <ErrorState message="Dashboard belum tersedia." onRetry={() => setRetry((value) => value + 1)} />

  const weekDays = data.kehadiran_minggu_ini.hari.map((day) => ({
    short: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(new Date(`${day.tanggal}T00:00:00`)),
    date: formatTanggal(day.tanggal).replace(/\s+\d{4}$/, ''),
    state: day.status === 'hari_ini' ? 'today' as const : day.status === 'selesai' ? 'done' as const : 'upcoming' as const,
    note: day.persen_hadir === null ? undefined : `${day.persen_hadir}%`,
  }))
  const trend = data.tren_kehadiran.map((day) => ({
    day: formatTanggal(day.tanggal).replace(/\s+\d{4}$/, ''),
    hadir: day.hadir,
    tepatWaktu: day.tepat_waktu,
  }))
  const latestAttendance = data.absensi_terbaru.map((item): DashboardAttendanceRow => ({
    name: item.karyawan.nama,
    division: item.departemen,
    checkIn: displayTime(item.jam_masuk),
    checkOut: displayTime(item.jam_pulang),
    status: item.status ? attendanceStatusLabels[item.status] : null,
  }))
  const closedDate = formatTanggal(data.sapaan_rekap.periode_ditutup)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <GreetingCard
          className="lg:col-span-2"
          greeting={config.mock.dashboard
            ? 'Selamat pagi, Rina!'
            : auth.user?.nama
              ? `Selamat pagi, ${auth.user.nama}!`
              : 'Selamat pagi!'}
          message={
            <>
              Rekap absensi hari ini sudah <strong className="text-heading">{data.sapaan_rekap.persen_terisi}% terisi</strong>. Ada{' '}
              <strong className="text-heading">{data.sapaan_rekap.pengajuan_menunggu} pengajuan</strong> yang menunggu persetujuan dan periode gaji
              ditutup pada {closedDate}.
            </>
          }
        >
          <div className="mt-auto flex flex-wrap gap-3">
            <Link
              href="/app/absensi/rekap"
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
          <WeekChips days={weekDays} />
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            Rata-rata minggu lalu {data.kehadiran_minggu_ini.rata_rata_minggu_lalu}% hadir
          </p>
        </Panel>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Total Karyawan" value={String(data.statistik.total_karyawan)} hint={`Aktif per ${formatTanggal(data.tanggal)}`} icon={Users} tone="blue" />
        <StatCard label="Hadir Hari Ini" value={String(data.statistik.hadir_hari_ini)} hint={`${data.statistik.persen_hadir}% dari total karyawan`} icon={UserCheck} tone="green" />
        <StatCard label="Terlambat" value={String(data.statistik.terlambat)} hint={`Lewat dari pukul ${data.statistik.batas_terlambat}`} icon={Clock} tone="amber" />
        <StatCard label="Tidak Hadir" value={String(data.statistik.tidak_hadir.total)} hint={`${data.statistik.tidak_hadir.izin} izin, ${data.statistik.tidak_hadir.cuti} cuti, ${data.statistik.tidak_hadir.alpha} alpha`} icon={CircleAlert} tone="red" />
        <StatCard
          className="col-span-2 2xl:col-span-1"
          label="Total Gaji Bulan Berjalan"
          value={formatRupiah(data.statistik.total_gaji_bulan_berjalan)}
          hint={`Periode ${data.statistik.periode_gaji}`}
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
            <AttendanceChart height="100%" data={trend} />
          </div>
        </Panel>

        <Panel title="Pengajuan menunggu persetujuan" description="Cuti, izin, sakit, koreksi absensi, dan lembur">
          <ApprovalsList />
        </Panel>
      </div>

      <Panel
        title="Absensi terbaru"
        description={`Check-in hari ini, ${formatTanggal(data.tanggal)}`}
        action={
          <Link href="/app/absensi" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Lihat semua
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        }
      >
        {latestAttendance.length
          ? <AttendanceTable rows={latestAttendance} caption="Daftar absensi terbaru hari ini" />
          : <p className="py-6 text-center text-sm text-muted-foreground">Belum ada absensi terbaru.</p>}
      </Panel>
    </div>
  )
}
